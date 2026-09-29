#!/usr/bin/env python3
"""Read a temporary Desktop database snapshot; emit numeric usage only, never text."""
import argparse, contextlib, datetime, hashlib, io, json, math, shutil, sys, tempfile
from collections import Counter
from pathlib import Path
from zoneinfo import ZoneInfo

FIELDS = ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens')
TARGETS = ('inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens')

def record_from_event(event, product, zone):
    payload = event.get('payload') if isinstance(event, dict) else None
    if not isinstance(payload, dict) or payload.get('type') != 'assistant':
        return None
    message = payload.get('message')
    if not isinstance(message, dict) or message.get('model') == '<synthetic>':
        return None
    usage = message.get('usage')
    identity = message.get('id')
    if not identity or not isinstance(usage, dict) or not all(k in usage for k in FIELDS[:2]):
        return None
    numbers = [usage.get(k, 0) for k in FIELDS]
    if any(not isinstance(n, (int, float)) or isinstance(n, bool) or not math.isfinite(n) or n < 0 or int(n) != n for n in numbers):
        return None
    if sum(numbers) > 9007199254740991:
        return None
    stamp = payload.get('timestamp') or event.get('serverCreatedAt')
    try:
        date = (datetime.datetime.fromtimestamp(stamp / (1000 if stamp > 1e11 else 1), datetime.timezone.utc)
                if isinstance(stamp, (int, float)) else datetime.datetime.fromisoformat(stamp.replace('Z', '+00:00')))
        if date.tzinfo is None:
            return None
        date = date.astimezone(ZoneInfo(zone)).date().isoformat()
    except (ValueError, TypeError, AttributeError, OverflowError):
        return None
    surface = {'cowork': 'desktop-cowork', 'code': 'desktop-code', 'claude-code': 'desktop-code', 'chat': 'desktop-chat'}.get(product, 'desktop-unclassified')
    return dict(id=hashlib.sha256(('message:' + str(identity)).encode()).hexdigest(), date=date,
                model=str(message.get('model') or 'unknown'), surfaces=[surface],
                **dict(zip(TARGETS, map(int, numbers))))

def scan(directory, zone):
    from ccl_chromium_reader import ccl_chromium_indexeddb as idb
    from ccl_chromium_reader.serialization_formats import ccl_blink_value_deserializer as blink, ccl_v8_value_deserializer as v8
    source = Path(directory)
    database = source / 'https_claude.ai_0.indexeddb.leveldb'
    blobs = source / 'https_claude.ai_0.indexeddb.blob'
    if not database.is_dir():
        return {'status': 'missing', 'records': [], 'diagnostics': {}}
    records, latest, seen = [], {}, set()
    diagnostics = Counter()
    def accept(value):
        if not isinstance(value, dict) or not isinstance(value.get('tree'), dict):
            return
        diagnostics['treeVersions'] += 1
        key = value.get('conversationUuid')
        if not key:
            diagnostics['unidentifiedTrees'] += 1
            return
        if key not in latest or value.get('writtenAt', 0) > latest[key].get('writtenAt', 0):
            latest[key] = value
        tree = value['tree']
        if not isinstance(tree.get('events'), list):
            diagnostics['unsupportedTrees'] += 1
            return
        for event in tree['events']:
            record = record_from_event(event, value.get('product'), zone)
            if record:
                signature = json.dumps(record, sort_keys=True)
                if signature not in seen:
                    seen.add(signature)
                    records.append(record)
    # Snapshot avoids taking a live LevelDB lock. TemporaryDirectory is private and removed.
    with tempfile.TemporaryDirectory(prefix='claude-usage-') as temporary, contextlib.redirect_stdout(io.StringIO()):
        target = Path(temporary)
        shutil.copytree(database, target / 'db', ignore=shutil.ignore_patterns('LOCK'))
        if blobs.exists():
            shutil.copytree(blobs, target / 'blobs')
        db = idb.WrappedIndexDB(target / 'db', target / 'blobs')
        try:
            store = db['claude-conversation-store']['trees']
            def failed(*args):
                diagnostics['unreadableHistoricalVersions'] += 1
            for record in store.iterate_records(live_only=True, bad_deserializer_data_handler=failed):
                accept(record.value)
            # Some extant blobs are unreachable through older LevelDB versions. They still
            # describe incurred usage; stable message IDs prevent double counting them.
            for file in (target / 'blobs').rglob('*'):
                if not file.is_file():
                    continue
                try:
                    precursor = db._raw_db.read_record_precursor(None, 0, 0, file.read_bytes(), None)
                    accept(v8.Deserializer(precursor[1], host_object_delegate=blink.BlinkV8Deserializer().read).read())
                except Exception:
                    diagnostics['unreadableBlobs'] += 1
        finally:
            db.close()
    diagnostics['conversations'] = len(latest)
    diagnostics['conversationsWithOlderUncachedMessages'] = sum(bool(v['tree'].get('hasOlder')) for v in latest.values())
    return {'status': 'partial-cache' if records else 'no-usage-observed', 'records': records,
            'diagnostics': dict(diagnostics),
            'products': dict(Counter(v.get('product') if v.get('product') in ('cowork', 'code', 'claude-code', 'chat') else 'unknown' for v in latest.values()))}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    parser.add_argument('--time-zone', default='Asia/Shanghai')
    args = parser.parse_args()
    try:
        result = scan(args.directory, args.time_zone)
    except Exception as error:
        # Error text may contain a private path or record content: emit only the class.
        result = {'status': 'error', 'records': [], 'diagnostics': {'errorType': type(error).__name__}}
    print(json.dumps(result, separators=(',', ':')))
    return 1 if result['status'] == 'error' else 0

if __name__ == '__main__':
    sys.exit(main())
