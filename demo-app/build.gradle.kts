// demo-app/build.gradle.kts
plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.featurepulse.demo"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.featurepulse.demo"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "FP_API_KEY", "\"${project.findProperty("FP_API_KEY") ?: ""}\"")
        buildConfigField("String", "FP_APP_ID",  "\"${project.findProperty("FP_APP_ID")  ?: ""}\"")
    }
    buildFeatures { viewBinding = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":sdk"))
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.fragment:fragment-ktx:1.6.2")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
