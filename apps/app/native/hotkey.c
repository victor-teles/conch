// Registers one system-wide hot key through Carbon. Unlike an NSEvent global
// monitor it needs no Accessibility trust, swallows the keystroke, and fires
// while this app is active.
#include <Carbon/Carbon.h>
#include <dispatch/dispatch.h>
#include <pthread.h>

typedef void (*conch_hotkey_callback)(void);

static conch_hotkey_callback pressed_callback = NULL;
static EventHandlerRef handler_ref = NULL;
static EventHotKeyRef hotkey_ref = NULL;

static OSStatus on_hotkey(EventHandlerCallRef next, EventRef event, void *context) {
  (void)next;
  (void)event;
  (void)context;
  if (pressed_callback != NULL) {
    pressed_callback();
  }
  return noErr;
}

static void unregister_on_main(void) {
  if (hotkey_ref != NULL) {
    UnregisterEventHotKey(hotkey_ref);
    hotkey_ref = NULL;
  }
}

static OSStatus register_on_main(UInt32 key_code, UInt32 modifiers) {
  if (handler_ref == NULL) {
    EventTypeSpec pressed = {kEventClassKeyboard, kEventHotKeyPressed};
    OSStatus installed = InstallEventHandler(GetApplicationEventTarget(), on_hotkey, 1,
                                             &pressed, NULL, &handler_ref);
    if (installed != noErr) {
      return installed;
    }
  }
  unregister_on_main();
  EventHotKeyID hotkey_id = {'cnch', 1};
  return RegisterEventHotKey(key_code, modifiers, hotkey_id, GetApplicationEventTarget(), 0,
                             &hotkey_ref);
}

// Carbon's event target belongs to the main thread; bun calls from a worker.
static void run_on_main(dispatch_block_t block) {
  if (pthread_main_np() != 0) {
    block();
    return;
  }
  dispatch_sync(dispatch_get_main_queue(), block);
}

int32_t conch_hotkey_register(uint32_t key_code, uint32_t modifiers,
                              conch_hotkey_callback callback) {
  __block OSStatus status = noErr;
  run_on_main(^{
    pressed_callback = callback;
    status = register_on_main(key_code, modifiers);
  });
  return (int32_t)status;
}

void conch_hotkey_unregister(void) {
  run_on_main(^{
    unregister_on_main();
    pressed_callback = NULL;
  });
}
