export const SITE = {
  phone: "+34 613 528 535",
  phoneHref: "tel:+34613528535",
  email: "Josepmartinadani80@gmail.com",
  addressLine1: "Playa de Puçol, Avinguda dels Pescadors, 201",
  addressLine2: "46530 Puçol, València",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=playa%20de%20Pu%C3%A7ol%2C%20Avinguda%20dels%20Pescadors%2C%20201%2C%2046530%20Puzol",
  legal: {
    name: "Daniel Blanch Baucells",
    address: "Av. Pescadores 201, 46530 Puzol, España",
    phone: "+34 634 277 296",
    email: "Josepmartinadani80@gmail.com",
    taxId: "47775767Y",
  },
};

export const IMAGES = {
  hero: "https://images.unsplash.com/photo-1779942579124-6fe3c1a686e0?crop=entropy&cs=srgb&fm=jpg&q=80&w=1800",
  heroBurger: "https://images.pexels.com/photos/36741809/pexels-photo-36741809.jpeg?auto=compress&cs=tinysrgb&w=900",
  story: "https://images.pexels.com/photos/24245659/pexels-photo-24245659.jpeg?auto=compress&cs=tinysrgb&w=1000",
  storyNight: "https://images.pexels.com/photos/26181553/pexels-photo-26181553.jpeg?auto=compress&cs=tinysrgb&w=900",
  burgers: "https://images.pexels.com/photos/36741809/pexels-photo-36741809.jpeg?auto=compress&cs=tinysrgb&w=1200",
  alitas: "https://images.pexels.com/photos/27668695/pexels-photo-27668695.jpeg?auto=compress&cs=tinysrgb&w=1200",
  poke: "https://images.unsplash.com/photo-1597958792579-bd3517df6399?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
  sides: "https://images.pexels.com/photos/12557551/pexels-photo-12557551.jpeg?auto=compress&cs=tinysrgb&w=1200",
  sweets: "https://images.unsplash.com/photo-1547414368-ac947d00b91d?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
  wings: "https://images.unsplash.com/photo-1637273484026-11d51fb64024?crop=entropy&cs=srgb&fm=jpg&q=80&w=900",
};

export function formatPrice(value: number, lang: "es" | "en"): string {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string, lang: "es" | "en"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
