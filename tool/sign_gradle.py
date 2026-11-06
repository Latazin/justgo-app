"""Configura a assinatura de release no android/app/build.gradle.kts gerado pelo CI.
Usa android/key.properties (criado pelo workflow a partir dos secrets)."""
import re, sys
p = 'android/app/build.gradle.kts'
s = open(p).read()
if 'keystoreProperties' in s:
    sys.exit(0)
head = '''import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

'''
s = head + s
signing = '''    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = keystoreProperties["storeFile"]?.let { file(it as String) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {'''
s = s.replace('    buildTypes {', signing, 1)
s = re.sub(r'signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)',
           'signingConfig = signingConfigs.getByName("release")', s, count=1)
open(p, 'w').write(s)
print('assinatura de release configurada')
