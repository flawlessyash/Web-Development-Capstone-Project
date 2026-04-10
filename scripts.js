// New Code



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
    const URL = "http://127.0.0.1:5003/products";
    const response = await fetch(URL);
    const data = await response.json();
    console.log(data);
 
    main(data.products);
 }
 
 getData();

