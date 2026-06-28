const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "rzp_test_SuJCOAavRIzGum",
  key_secret: "wd2Laydm0d0uVlpU6gr2RewM",
});

async function test() {
  try {
    const order = await razorpay.orders.create({
      amount: 100,
      currency: "INR",
      receipt: "test123",
    });

    console.log(order);
  } catch (err) {
    console.log(err);
  }
}

test();