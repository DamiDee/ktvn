// K-Rides Free Buses – push notification service worker
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "K-Rides Free Buses", body: event.data.text() };
  }
  const { title = "K-Rides Free Buses", body = "", url = "/passenger/free-buses", icon = "/favicon.ico" } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/favicon.ico",
      tag: payload.tag ?? "freebus",
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/passenger/free-buses";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
