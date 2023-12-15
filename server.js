const express = require("express");
const { generateApiKey } = require("generate-api-key");
const db = require("./firebase");
const app = express();
const PORT = 1337;
require("dotenv").config();

//Variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SK;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const DOMAIN = "http://localhost:1337";

// Middleware
app.use(express.static("public"));

//routes
app.get("/api", (req, res) => {
  //recieve API key
  const { api_key } = req.query;
  if (!api_key) {
    return res.sendStatus(403);
  }
  res.status(200).send({ message: "You can do it, dont give up yet!." });
});

app.get("/check_status", async (req, res) => {
  const { api_key } = req.query; // allows the user to check the api key
  const doc = await db.collection("api_keys").doc(api_key).get();
  if (!doc.exists) {
    res.sendStatus(500);
  } else {
    const status = doc.data();
    res.status(200).send("status: ", status);
  }
});

app.post("/create-checkout-session/:product", async (req, res) => {
  const { product } = req.params;
  let mode, price_ID, line_items;

  if (product === "sub") {
    price_ID = "price_1ONYQtAzLKycD19N9zTwTU2d";
    mode = "subscription";
    line_items = [
      {
        price: price_ID,
      },
    ];
    quantity_type = 10;
  } else if (product === "pre") {
    price_ID = "price_1ONYOtAzLKycD19NxLt3kmUO";
    mode = "payment";
    line_items = [
      {
        price: price_ID,
        quantity: 1,
      },
    ];
  } else {
    return res.sendStatus(403);
  }

  const newAPIKey = generateApiKey();
  const customer = await stripe.customers.create({
    metadata: {
      APIkey: newAPIKey,
    },
  });

  const stripeCustomerId = customer.id;
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    metadata: {
      APIkey: newAPIKey,
      paymentType: product,
    },
    line_items: line_items,
    mode: mode,
    success_url: `${DOMAIN}/success.html?api_key=${newAPIKey}`,
    cancel_url: `${DOMAIN}/cancel.html`,
  });

  // create firebase record
  const data = {
    APIkey: newAPIKey,
    payment_type: product,
    stripeCustomerId,
    status: null,
  };
  // merge true, that merges whatever current data is already there and not create a new entry
  const dbRes = await db
    .collection("api_keys")
    .doc(newAPIKey)
    .set(data, { merge: true });

  // use webhook to access the firebase entry for that api key and ensure that billing info is updated accordingly

  res.redirect(303, session.url);
});

app.listen(PORT, () => console.log("Server has started on port: ", PORT));
