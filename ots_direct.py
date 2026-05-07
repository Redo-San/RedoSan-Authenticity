#!/usr/bin/env python3
import hashlib, sys, os
from opentimestamps.core.timestamp import Timestamp, DetachedTimestampFile
from opentimestamps.core.op import OpSHA256
from opentimestamps.core.serialize import StreamSerializationContext, BytesDeserializationContext
from opentimestamps.calendar import RemoteCalendar, DEFAULT_AGGREGATORS

def stamp_file(filepath):
    with open(filepath, 'rb') as f:
        dtf = DetachedTimestampFile.from_fd(OpSHA256(), f)
    timestamp = dtf.timestamp
    success = False
    for url in DEFAULT_AGGREGATORS:
        print(f"    Submitting to: {url}")
        try:
            cal = RemoteCalendar(url)
            cal_timestamp = cal.submit(timestamp.msg)
            timestamp.merge(cal_timestamp)
            print(f"    Success!")
            success = True
            break
        except Exception as e:
            print(f"    Failed: {e}")
    if not success:
        print("    ERROR: All calendars failed")
        return False
    with open(filepath + '.ots', 'wb') as f:
        ctx = StreamSerializationContext(f)
        dtf.serialize(ctx)
    print(f"    OTS proof saved to: {filepath}.ots")
    return True

def verify_file(filepath):
    ots_path = filepath + '.ots'
    if not os.path.exists(ots_path):
        print(f"    ERROR: {ots_path} not found")
        return False
    with open(filepath, 'rb') as f:
        dtf = DetachedTimestampFile.from_fd(OpSHA256(), f)
    current_digest = dtf.timestamp.msg
    with open(ots_path, 'rb') as f:
        data = f.read()
    ctx = BytesDeserializationContext(data)
    ots_dtf = DetachedTimestampFile.deserialize(ctx)
    ots_digest = ots_dtf.timestamp.msg
    if current_digest == ots_digest:
        print(f"    INTEGRITY: Hash matches - file is authentic")
        print(f"    SHA-256: {current_digest.hex()}")
        print(f"    OTS file: {ots_path}")
        return True
    else:
        print(f"    INTEGRITY FAILURE: File hash differs from OTS proof!")
        print(f"    Current: {current_digest.hex()}")
        print(f"    OTS:     {ots_digest.hex()}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python ots_direct.py <command> <file>")
        print("Commands: stamp, verify")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "stamp" and len(sys.argv) >= 3:
        sys.exit(0 if stamp_file(sys.argv[2]) else 1)
    elif cmd == "verify" and len(sys.argv) >= 3:
        sys.exit(0 if verify_file(sys.argv[2]) else 1)
    else:
        print("Unknown command or missing arguments")
        sys.exit(1)
