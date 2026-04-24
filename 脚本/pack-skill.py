import os
import zipfile
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(root, '_dist')
out_zip = os.path.join(root, 'sap-report-automation-workflow-skill.zip')

if not os.path.exists(src_dir):
    print(f"[ERR] Source dir not found: {src_dir}")
    sys.exit(1)

if os.path.exists(out_zip):
    os.remove(out_zip)

with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(src_dir):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            arcname = os.path.relpath(filepath, src_dir)
            zf.write(filepath, arcname)
            print(f"[ADD] {arcname}")

size_mb = os.path.getsize(out_zip) / 1024 / 1024
print(f"\n[OK] Packaged: {out_zip}")
print(f"     Size: {size_mb:.1f} MB")
