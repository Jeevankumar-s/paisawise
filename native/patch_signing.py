from pathlib import Path
import sys

gradle = Path(sys.argv[1])
text = gradle.read_text()
assert "signingConfigs {" in text, "Android Gradle template changed: signingConfigs missing"
assert "signingConfig signingConfigs.debug" in text, "Android Gradle template changed: debug signing reference missing"
release = """
        release {
            storeFile file(System.getenv("PAISAWISE_KEYSTORE_PATH"))
            storePassword System.getenv("PAISAWISE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("PAISAWISE_KEY_ALIAS")
            keyPassword System.getenv("PAISAWISE_KEY_PASSWORD")
        }
"""
text = text.replace("signingConfigs {", "signingConfigs {" + release, 1)
# The RN template uses debug signing in both debug and release configurations.
# Replace the final occurrence only, leaving the debug build unchanged.
head, separator, tail = text.rpartition("signingConfig signingConfigs.debug")
assert separator, "Expected release signing configuration missing"
text = head + "signingConfig signingConfigs.release" + tail
gradle.write_text(text)
