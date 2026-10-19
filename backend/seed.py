"""Seed the real Secret Spot menu. Idempotent: only inserts when the menu is empty (use --reset to reload)."""

import asyncio
import sys

from lib.db import db, ensure_indexes
from models.restaurant import MenuItem

A_BURGER = "1, 3, 7, 10, 12"
FRIES_ES = " Con patatas."
FRIES_EN = " Served with fries."

MENU = [
    # Burgers
    ("Cheese Bacon", "burgers", "180g de carne, bacon, queso cheddar y salsa especial.", "180g beef patty, bacon, cheddar cheese and special sauce.", 9.5, [], A_BURGER),
    ("Perfecta", "burgers", "180g de carne, tomate, lechuga, cebolla morada y salsa especial.", "180g beef patty, tomato, lettuce, red onion and special sauce.", 10, [], A_BURGER),
    ("La de Pollo", "burgers", "Pollo kentucky, cheddar, bacon, salsas bbq y especial, lechuga, cebolla y pepinillos.", "Kentucky-style fried chicken, cheddar, bacon, BBQ and special sauces, lettuce, onion and pickles.", 10, [], A_BURGER),
    ("Big Secret", "burgers", "Doble carne 360g, doble cheddar, bacon, salsa wings y toque de bbq.", "Double 360g beef, double cheddar, bacon, wings sauce and a touch of BBQ.", 14.5, ["star"], A_BURGER),
    ("Trufembert", "burgers", "180g de carne, cebolla crunchy y caramelizada, mayonesa trufada y crema de camembert.", "180g beef, crunchy and caramelised onion, truffle mayo and camembert cream.", 11.5, [], A_BURGER),
    ("Smoky", "burgers", "180g de carne, cebolla morada, queso ahumado, bacon ahumado y salsa de chipotles ahumados.", "180g beef, red onion, smoked cheese, smoked bacon and smoked chipotle sauce.", 11.5, ["spicy"], A_BURGER),
    ("Rib Curl", "burgers", "180g de carne, costilla de cerdo desmenuzada, salsa bbq, cheddar, pepinillos, cebolla morada y salsa especial.", "180g beef, pulled pork rib, BBQ sauce, cheddar, pickles, red onion and special sauce.", 13.5, [], A_BURGER),
    ("Green Wave", "burgers", "180g de burger vegana de soja y vegetales, rúcula, tomate seco, cebolla morada y salsa de sésamo.", "180g vegan soy & vegetable patty, rocket, sun-dried tomato, red onion and sesame sauce.", 13, ["vegan"], A_BURGER),
    # Alitas
    ("Clásicas", "alitas", "Alitas de pollo crujientes, receta de la casa.", "Crispy chicken wings, house recipe.", 8, [], "1, 7"),
    ("Parmesano", "alitas", "Alitas crujientes con parmesano.", "Crispy wings with parmesan.", 9, [], "1, 7"),
    ("BBQ", "alitas", "Alitas glaseadas en salsa barbacoa.", "Wings glazed in barbecue sauce.", 9, [], "1, 7"),
    ("Búfalo", "alitas", "Alitas con salsa búfalo picantita.", "Wings tossed in tangy buffalo sauce.", 9, ["spicy"], "1, 7"),
    ("Xtrahot", "alitas", "Para valientes: nuestra salsa más picante.", "For the brave: our hottest sauce.", 9, ["spicy"], "1, 7, 12"),
    ("Wing Lover", "alitas", "Ración grande para los fans de las alitas.", "A big share for true wing lovers.", 13.5, ["star"], "1, 7, 12"),
    # Poké
    ("Salmón Bowl", "poke", "Bowl de arroz con salmón fresco y toppings.", "Rice bowl with fresh salmon and toppings.", 11, [], "3, 4, 6, 11, 12"),
    ("Tuna Bowl", "poke", "Bowl de arroz con atún y toppings.", "Rice bowl with tuna and toppings.", 11, [], "3, 4, 6, 11, 12"),
    ("Chicken Bowl", "poke", "Bowl de arroz con pollo y toppings.", "Rice bowl with chicken and toppings.", 9.5, [], "3, 4, 6, 11, 12"),
    ("Spicy Mix Bowl", "poke", "Mezcla de salmón y atún con salsa picante.", "Salmon and tuna mix with spicy sauce.", 11.5, ["spicy"], "3, 4, 6, 11, 12"),
    # Sides
    ("Nuggets", "sides", "Nuggets de pollo crujientes.", "Crispy chicken nuggets.", 6.5, [], ""),
    ("Super Combo", "sides", "Combo para compartir de nuestros entrantes.", "Sharing combo of our favourite sides.", 11, ["star"], ""),
    ("Croquetas", "sides", "Croquetas caseras (precio por unidad).", "Homemade croquettes (price per piece).", 1.5, [], "1, 7, 9, 10, 12"),
    ("Super Nachos", "sides", "Nachos cargados para compartir.", "Loaded nachos to share.", 10, [], ""),
    ("Patatas Fritas Secret", "sides", "Nuestras patatas con el toque secreto.", "Our fries with the secret touch.", 6, [], ""),
    ("Tequeños", "sides", "Palitos de masa rellenos de queso.", "Cheese-filled pastry sticks.", 8, [], "1, 7, 9, 10, 12"),
    # Sweets
    ("Cheesecake Lotus u Oreo", "sweets", "Tarta de queso cremosa, elige Lotus u Oreo.", "Creamy cheesecake, choose Lotus or Oreo.", 4.5, ["star"], ""),
    ("Tarta del Día o Brownie", "sweets", "Pregunta por la tarta del día o pide nuestro brownie.", "Ask for the cake of the day or go for our brownie.", 4.5, [], "1, 3, 7"),
]


async def main() -> None:
    reset = "--reset" in sys.argv
    await ensure_indexes()
    if reset:
        await db.menu_items.delete_many({})
    if await db.menu_items.count_documents({}) > 0:
        print("menu already seeded")
        return
    docs = []
    for i, (name, cat, es, en, price, tags, allergens) in enumerate(MENU):
        if cat == "burgers":
            es, en = es + FRIES_ES, en + FRIES_EN
        docs.append(
            MenuItem(
                name=name, category=cat, description_es=es, description_en=en, price=price,
                price_note="ud." if name == "Croquetas" else "", tags=tags, allergens=allergens,
                sort_order=i,
            ).model_dump()
        )
    await db.menu_items.insert_many(docs)
    print(f"seeded {len(docs)} menu items")


if __name__ == "__main__":
    asyncio.run(main())
