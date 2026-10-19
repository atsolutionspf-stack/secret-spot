# Secret Spot — New Restaurant Website

## What it is
A new website for Secret Spot, a burger, wings and street-food spot on Puçol beach. Guests can browse the menu, book a table and send a message. The owner gets a PIN-protected panel to run bookings, messages and the menu.

## Who it's for
- **Guests** (locals, beachgoers, Instagram visitors on their phones) who want to see the food and prices, check opening hours and book a table quickly.
- **The owner/staff**, who need one place to see and handle bookings and messages, and to keep menu prices up to date without help from a developer.

## Core features and experience
- **Style:** a bold beach-at-night street-food look. Dark background, neon and warm accents, large food photos, and lively but smooth animations. Built mobile-first, since most visitors arrive from Instagram.
- **Languages:** Spanish (default) and English, with a toggle in the header. All fixed page text appears in both languages. Menu dish names stay as they are, with descriptions in both languages.
- **Home:** a hero section with the "Hacer una reserva" and "Nuestro menú" buttons, a short story about the place, the services (terrace, sea view, rooftop bar, live music, pets welcome, kids' area, parking, accessibility, takeaway, catering, weddings and private events), and payment options.
- **Interactive menu:** category tabs for Burgers, Alitas, Poké Bowls, Sides and Sweets. Each item shows its name, description, price and a tag such as "Vegan" or "Spicy". The real current menu comes pre-loaded (for example Cheese Bacon €9.50, Big Secret €14.50, Green Wave vegan €13, Wing Lover €13.50, Super Nachos €10, Lotus/Oreo Cheesecake €4.50). Only items marked available are shown.
- **Table booking:** guests enter name, phone, email, date, time, party size and an optional note. Only opening days and hours can be picked: Thursday 19:00–00:00, Friday to Sunday 19:00–01:00, closed Monday to Wednesday. Guests see a confirmation on screen. Each booking starts as "Pending".
- **Contact:** a message form (name, email, phone, subject, message up to 500 characters), click-to-call +34 613 528 535, an email link, the address (Avinguda dels Pescadors 201, 46530 Puçol) with a "Show map" link to Google Maps, and the opening hours with a live "Open now / Closed" badge.
- **Admin panel (/admin, PIN login):**
  - Bookings: list by date, filter by status, and mark each as Confirmed, Cancelled or Completed.
  - Messages: inbox with read/unread status and delete.
  - Menu: add, edit and delete items, change prices and descriptions, and hide or show an item (for example when it sells out).
- **Footer:** contact details, opening hours, and a legal notice link with the owner's published business details.

## Phase 1: what gets built now
- The full public site in Spanish and English: home, interactive menu with the real items and prices, booking form limited to opening hours, and contact form with hours and a map link.
- The PIN-protected admin panel for bookings, messages and menu editing. The starting PIN will be listed in the handoff and can be changed later.
- Food photos will be high-quality stock or generated images, since the current site has no dish photos. The owner's own photos can replace them later.
- **Not included in this phase:** online takeaway ordering or payment, email/SMS/WhatsApp alerts to the owner or guests (new bookings and messages show up only in the admin panel), and checks on table capacity (every request is accepted as "Pending" for the owner to confirm).
