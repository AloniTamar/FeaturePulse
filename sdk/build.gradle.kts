// sdk/build.gradle.kts
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    `maven-publish`
}

android {
    namespace = "com.featurepulse"
    compileSdk = 34
    defaultConfig {
        minSdk = 21
        targetSdk = 34
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions { jvmTarget = "1.8" }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.fragment:fragment-ktx:1.6.2")
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("androidx.test:core-ktx:1.5.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                groupId    = "com.github.featurepulse"
                artifactId = "sdk"
                version    = "1.0.0"
                pom {
                    name.set("FeaturePulse SDK")
                    description.set("Android SDK for automatic dead feature detection")
                    url.set("https://github.com/featurepulse/featurepulse")
                    licenses {
                        license {
                            name.set("MIT License")
                            url.set("https://opensource.org/licenses/MIT")
                        }
                    }
                }
            }
        }
    }
}
