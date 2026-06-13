package com.featurepulse.internal.buffer

import android.content.Context
import com.featurepulse.internal.model.RawEvent
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

internal class BufferPersistence(context: Context) {

    companion object {
        private const val KEY = "pending_events"
    }

    private val prefs = context.applicationContext.getSharedPreferences("fp_buffer", Context.MODE_PRIVATE)
    private val gson = Gson()

    @Synchronized
    fun save(events: List<RawEvent>) {
        prefs.edit().putString(KEY, gson.toJson(events)).apply()
    }

    @Synchronized
    fun load(): List<RawEvent> {
        val json = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<RawEvent>>() {}.type
            gson.fromJson<List<RawEvent>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            clear()
            emptyList()
        }
    }

    @Synchronized
    fun clear() {
        prefs.edit().remove(KEY).apply()
    }
}
