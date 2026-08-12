mod extractor;
mod image_utils;
mod indexer;
mod keyword_engine;
mod photo;
mod scanner;
mod watcher;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::Manager;
use scanner::ScanControlState;
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(WatcherState::default())
    .manage(ScanControlState::default())
    .invoke_handler(tauri::generate_handler![
      scanner::scan_directory,
      scanner::read_file_binary,
      scanner::open_file_with_default_app,
      scanner::list_subdirectories,
      scanner::pause_scan,
      scanner::resume_scan,
      scanner::cancel_scan,
      watcher::start_watching,
      watcher::stop_watching,
      indexer::extract_and_analyze,
      indexer::extract_and_analyze_batch,
      photo::generate_photo_thumbnail,
      photo::generate_photo_full_res
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }

      // Build System Tray Menu
      let open_item = MenuItem::with_id(app, "open", "Picasa Studio 열기", true, None::<&str>)?;
      let status_item = MenuItem::with_id(app, "status", "🟢 실시간 폴더 감시 중 (0.0% CPU)", false, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "완전 종료 (Quit)", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&open_item, &status_item, &quit_item])?;

      if let Some(icon) = app.default_window_icon().cloned() {
        let _tray = TrayIconBuilder::new()
          .icon(icon)
          .tooltip("Picasa Web Studio (실시간 백그라운드 색인 중)")
          .menu(&menu)
          .show_menu_on_left_click(false)
          .on_menu_event(|app, event| {
            match event.id.as_ref() {
              "open" => {
                if let Some(window) = app.get_webview_window("main") {
                  let _ = window.show();
                  let _ = window.set_focus();
                }
              }
              "quit" => {
                app.exit(0);
              }
              _ => {}
            }
          })
          .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
              let app = tray.app_handle();
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
          })
          .build(app)?;
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Prevent actual window destroy; hide to system tray
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
