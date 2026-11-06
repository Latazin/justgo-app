"""Regras do R8 (proguard-rules.pro) no build de release do projeto gerado pelo CI."""
import re
p = 'android/app/build.gradle.kts'
s = open(p).read()
if 'proguard-rules.pro' not in s:
    s, n = re.subn(r'(\n(\s*)release \{\n)', r'\1\2    proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")\n', s, count=1)
    if not n: raise SystemExit('bloco release nao encontrado')
open(p, 'w').write(s)
print('regras do R8 aplicadas')
