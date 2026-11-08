"""Extract only the exact original ZIP after bounded path/type/size validation."""
import hashlib, json, re, stat, sys, zipfile
from pathlib import Path

EXPECTED = 'c2b3b21a6f248a5d13c56583310e5569f110bc100538d833db3473d6db7bec0c'

def extract(source, target, expected=EXPECTED):
    source, target = Path(source), Path(target)
    assert source.is_file() and not source.is_symlink() and source.stat().st_size <= 131072
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
    target.mkdir(exist_ok=False)
    manifest, seen, total = [], set(), 0
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        assert len(entries) <= 256
        for member in entries:
            name = member.filename
            assert member.orig_filename == name  # Reject platform normalization and NUL truncation.
            assert name not in seen
            seen.add(name)
            parts = name.rstrip('/').split('/')
            assert 1 <= len(parts) <= 6 and all(re.fullmatch(r'[a-zA-Z0-9_.-]+', p) and p not in ('.', '..') for p in parts)
            mode = member.external_attr >> 16
            kind = stat.S_IFMT(mode)
            assert kind in (0, stat.S_IFREG, stat.S_IFDIR)
            assert not member.flag_bits & 1
            assert 0 <= member.file_size <= 1048576
            total += member.file_size
            assert total <= 4194304
            destination = target.joinpath(*parts)
            if member.is_dir():
                assert kind in (0, stat.S_IFDIR) and member.file_size == 0
                destination.mkdir(parents=True, exist_ok=True)
                continue
            assert kind in (0, stat.S_IFREG)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as stream:
                data = stream.read(1048577)
                assert len(data) == member.file_size and len(data) <= 1048576
            with destination.open('xb') as output:
                output.write(data)
            manifest.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return manifest

if __name__ == '__main__':
    manifest = extract(sys.argv[1], sys.argv[2])
    Path('evidence/extracted-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Bounded extraction PASS; files:', len(manifest))
