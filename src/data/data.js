export const products=[
{id:1,name:"Hamburguesa Clásica",category:"Hamburguesas",price:22000,cost:8500,sold:148,active:true},
{id:2,name:"Pasta Alfredo",category:"Pastas",price:26000,cost:10500,sold:96,active:true},
{id:3,name:"Pizza Pepperoni",category:"Pizzas",price:30000,cost:12500,sold:132,active:true},
{id:4,name:"Limonada Natural",category:"Bebidas",price:8000,cost:2500,sold:210,active:true},
{id:5,name:"Brownie con Helado",category:"Postres",price:12000,cost:4000,sold:75,active:true}
];
export const orders=[
{id:"#1048",customer:"Laura Gómez",items:"2 × Hamburguesa Clásica",total:44000,status:"En preparación",time:"7:42 PM"},
{id:"#1047",customer:"Andrés Ruiz",items:"1 × Pizza Pepperoni + 2 × Limonada",total:46000,status:"Listo",time:"7:28 PM"},
{id:"#1046",customer:"Sofía Martínez",items:"1 × Pasta Alfredo + Brownie",total:38000,status:"Completado",time:"7:11 PM"},
{id:"#1045",customer:"Carlos Pérez",items:"3 × Hamburguesa Clásica",total:66000,status:"Completado",time:"6:54 PM"}
];
export const customers=[
{name:"Laura Gómez",orders:18,total:486000,last:"Hoy",favorite:"Hamburguesa Clásica"},
{name:"Andrés Ruiz",orders:14,total:392000,last:"Hoy",favorite:"Pizza Pepperoni"},
{name:"Sofía Martínez",orders:11,total:281000,last:"Ayer",favorite:"Pasta Alfredo"},
{name:"Carlos Pérez",orders:9,total:216000,last:"3 días",favorite:"Hamburguesa Clásica"}
];

// --- CLIENT MOCK DATA ---

export const restaurantInfo = {
  name: "La Esquina Food",
  description: "Comida deliciosa, preparada al momento con los mejores ingredientes.",
  status: "open", // open, closed
  schedule: "Lunes a Domingo - 11:00 AM a 10:00 PM",
  bannerImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  logo: "https://ui-avatars.com/api/?name=LE&background=e85d3f&color=fff&size=150"
};

export const clientMenu = [
  {
    id: "c1",
    name: "Hamburguesas",
    products: [
      {
        id: "p1",
        name: "Classic Burger",
        description: "Carne artesanal de 150g, queso cheddar, tomate, lechuga fresca y salsa de la casa.",
        price: 22000,
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: [
          { id: "opt1", name: "Queso extra", price: 3000 },
          { id: "opt2", name: "Tocino", price: 4000 },
          { id: "opt3", name: "Cebolla caramelizada", price: 2000 }
        ]
      },
      {
        id: "p2",
        name: "Double Smash",
        description: "Doble carne tipo smash, doble queso cheddar, tocino ahumado y salsa BBQ.",
        price: 28000,
        image: "https://images.unsplash.com/photo-1594212202206-b1836171f845?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: [
          { id: "opt1", name: "Queso extra", price: 3000 },
          { id: "opt2", name: "Tocino extra", price: 4000 }
        ]
      }
    ]
  },
  {
    id: "c2",
    name: "Entradas",
    products: [
      {
        id: "p3",
        name: "Papas Especiales",
        description: "Papas a la francesa crocantes con queso fundido y trocitos de tocino.",
        price: 12000,
        image: "https://images.unsplash.com/photo-1576107232684-1279f3908581?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: []
      },
      {
        id: "p4",
        name: "Aros de Cebolla",
        description: "Aros de cebolla apanados con salsa ranch.",
        price: 10000,
        image: "https://images.unsplash.com/photo-1639024470295-883dfb2eb4b2?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: []
      }
    ]
  },
  {
    id: "c3",
    name: "Bebidas",
    products: [
      {
        id: "p5",
        name: "Coca-Cola",
        description: "400ml",
        price: 5000,
        image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: []
      },
      {
        id: "p6",
        name: "Limonada Natural",
        description: "Limonada natural en agua o leche.",
        price: 7000,
        image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80",
        available: true,
        options: [
          { id: "opt4", name: "En leche (Cerezada)", price: 2000 }
        ]
      }
    ]
  }
];
