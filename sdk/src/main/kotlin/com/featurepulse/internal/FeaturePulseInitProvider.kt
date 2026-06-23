package com.featurepulse.internal

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig

class FeaturePulseInitProvider : ContentProvider() {

    override fun onCreate(): Boolean {
        val ctx = context?.applicationContext ?: return false
        val application = ctx as? android.app.Application ?: return false

        val appInfo = try {
            ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA)
        } catch (_: PackageManager.NameNotFoundException) {
            return false
        }

        val apiKey = appInfo.metaData?.getString("com.featurepulse.sdk.API_KEY")
        if (apiKey.isNullOrBlank()) return false

        val appId = appInfo.metaData?.getString("com.featurepulse.sdk.APP_ID") ?: ctx.packageName

        FeaturePulse.init(
            application,
            PulseConfig.Builder()
                .setApiKey(apiKey)
                .setAppId(appId)
                .build()
        )
        return true
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
