// const newCard = document.createElement("div");
// newCard.className = "card";
// newCard.innerHTML = `
//    <img src="https://cloud-computing-lectures-likhilesh-abcdxyz.s3.ap-south-1.amazonaws.com/likhi-laptop.jpg" />
//    <div class="product-info">
//        <h4>Macbook Pro M1 - 2022</h4>
//        <p>Price: $1100</p>
//        <p>Rating: 4.9⭐️</p>
//    </div>
// `;


// const root = document.getElementById("root");
// root.appendChild(newCard);




















// const title = "Macbook Pro M1 - 2022";
// const price = "$1100";
// const rating = 4.9;


// const newCard = document.createElement("div");
// newCard.className = "card";
// newCard.innerHTML = `
//    <img src="https://cloud-computing-lectures-likhilesh-abcdxyz.s3.ap-south-1.amazonaws.com/likhi-laptop.jpg" />
//    <div class="product-info">
//        <h4> ${title} </h4>
//        <p>Price: ${price} </p>
//        <p>Rating: ${rating} ⭐️</p>
//    </div>
// `;


// const root = document.getElementById("root");
// root.appendChild(newCard);


























// const products = [
//    {
//        title: "Bag",
//        price: "$200",
//        rating: 4.2,
//    },
//    {
//        title: "Mat",
//        price: "$100",
//        rating: 3.9,
//    },
// ];



// const newCard1 = document.createElement("div");
// newCard1.className = "card";
// newCard1.innerHTML = `
//    <img src="https://images.jdmagicbox.com/quickquotes/images_main/sara-30-liters-polyester-black-school-bag-black-178207114-ksaft.jpg" />
//    <div class="product-info">
//        <h4> ${products[0].title} </h4>
//        <p>Price: ${products[0].price} </p>
//        <p>Rating: ${products[0].rating} ⭐️</p>
//    </div>
// `;
// const root = document.getElementById("root");
// root.appendChild(newCard1);



// const newCard2 = document.createElement("div");
// newCard2.className = "card";
// newCard2.innerHTML = `
//    <img src="https://rukminim2.flixcart.com/image/480/640/l58iaa80/mat/z/t/w/medium-natural-korai-grass-sleeping-mat-3-5-x-6-feet-river-grass-original-imagfyhgq4jvgmrg.jpeg?q=90" />
//    <div class="product-info">
//        <h4> ${products[1].title} </h4>
//        <p>Price: ${products[1].price} </p>
//        <p>Rating: ${products[1].rating} ⭐️</p>
//    </div>
// `;
// root.appendChild(newCard2);























const products = [
   {
       title: "Bag",
       price: "$200",
       rating: 4.2,
       thumbnail: "https://images.jdmagicbox.com/quickquotes/images_main/sara-30-liters-polyester-black-school-bag-black-178207114-ksaft.jpg",
   },
   {
       title: "Mat",
       price: "$100",
       rating: 3.9,
       thumbnail: "https://rukminim2.flixcart.com/image/480/640/l58iaa80/mat/z/t/w/medium-natural-korai-grass-sleeping-mat-3-5-x-6-feet-river-grass-original-imagfyhgq4jvgmrg.jpeg?q=90",
   },
];




function main(arr) {
   	for (let i = 0; i < arr.length; i++) {
       	const newCard = document.createElement("div");
       	newCard.className = "card";
       	newCard.innerHTML = `
       		<img src="${arr[i].thumbnail}" />
       		<div class="product-info">
           			<h4> ${arr[i].title} </h4>
          		 	<p>Price: ${arr[i].price} </p>
          		 	<p>Rating: ${arr[i].rating} ⭐️</p>
       		</div>
   		`;
       	const root = document.getElementById("root");
       	root.appendChild(newCard);
   	}


}

 async function getData() {
    const URL = "https://dummyjson.com/products?select=title,price,rating,thumbnail";
    const response = await fetch(URL);
    const data = await response.json();
    console.log(data);
 
    main(data.products);
 }
 
 getData();

