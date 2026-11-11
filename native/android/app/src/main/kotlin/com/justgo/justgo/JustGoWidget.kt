package com.justgo.justgo

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

// Widget da tela inicial: km da semana, meta e ofensiva. O app manda os números (JgWidget).
class JustGoWidget : HomeWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
        val km = widgetData.getString("km", null)?.takeIf { it.isNotEmpty() } ?: "0"
        val goal = widgetData.getString("goal", null)?.takeIf { it.isNotEmpty() } ?: "Abra o app para começar"
        val pct = widgetData.getString("pct", null)?.toIntOrNull() ?: 0
        val streak = widgetData.getString("streak", null)?.takeIf { it.isNotEmpty() } ?: "Treine hoje"
        appWidgetIds.forEach { id ->
            val v = RemoteViews(context.packageName, R.layout.justgo_widget).apply {
                setTextViewText(R.id.w_km, km)
                setTextViewText(R.id.w_goal, goal)
                setTextViewText(R.id.w_streak, streak)
                setProgressBar(R.id.w_bar, 100, pct.coerceIn(0, 100), false)
                setOnClickPendingIntent(R.id.w_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java))
            }
            appWidgetManager.updateAppWidget(id, v)
        }
    }
}
