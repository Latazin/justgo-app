# Gera version.json: lista dos arquivos do app com hash.
# O app Android compara o "build" com o dele e baixa só o que mudou.
# Rode antes de publicar:  python3 tool/make_version.py
import hashlib, json, os, time
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'web')
SKIP_DIRS = {'tool', 'supabase', '.git'}
SKIP_FILES = {'sw.js', 'netlify.toml', 'README.md', 'version.json', '.DS_Store'}
MIN_NATIVE = 26  # versão mínima do APK que entende este pacote
files = []
for d, dirs, fs in os.walk(ROOT):
    dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
    for f in sorted(fs):
        if f in SKIP_FILES: continue
        full = os.path.join(d, f); rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
        data = open(full, 'rb').read()
        files.append({'p': rel, 's': hashlib.sha256(data).hexdigest(), 'n': len(data)})
build = int(time.strftime('%Y%m%d%H%M', time.gmtime()))
json.dump({'build': build, 'minNative': MIN_NATIVE, 'files': files}, open(os.path.join(ROOT, 'version.json'), 'w'), separators=(',', ':'))
print('version.json · build', build, '·', len(files), 'arquivos')
