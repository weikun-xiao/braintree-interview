const API_BASE = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://127.0.0.1:8080"      // local backend
  : "https://braintree-interview.onrender.com"; // deployed backend

async function initBraintree() {
  // Fetch client token from server
  const res = await fetch(`${API_BASE}/client_token`);
  const { clientToken } = await res.json();

  // Create Braintree client
  braintree.client.create(
    {
      authorization: clientToken,
    },
    function (clientErr, clientInstance) {
      if (clientErr) {
        // Handle error in client creation
        calert("Client init failed: " + clientErr);
        return;
      }
      // Create Hosted Fields
      braintree.hostedFields.create(
        {
          client: clientInstance,
          styles: {
            input: { "font-size": "16px", color: "#333" },
            ".valid": { color: "green" },
            ".invalid": { color: "red" },
          },
          fields: {
            number: {
              container: "#card-number",
              placeholder: "4111 1111 1111 1111",
            },
            cvv: {
              container: "#cvv",
              placeholder: "123",
            },
            expirationDate: {
              container: "#expiration-date",
              placeholder: "10/2030",
            },
          },
        },
        function (hostedFieldsErr, hostedFieldsInstance) {
          if (hostedFieldsErr) {
            // Handle error in Hosted Fields creation
            alert("Hosted fields failed: " + hostedFieldsErr);
            return;
          }

          // Handle customer search
          document
            .getElementById("search-customer-btn")
            .addEventListener("click", () => {
              const customerId =
                document.getElementById("customer-id").value;

              fetch("/search-customer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId: customerId }),
              })
                .then((res) => res.json())
                .then((data) => {
                  const infoDiv = document.getElementById("customer-info");
                  infoDiv.innerHTML = "";

                  if (data.success && data.payment_methods.length > 0) {
                    infoDiv.innerHTML = `<h3>Customer ${data.customer_id}</h3>`;
                    data.payment_methods.forEach((pm) => {
                      const pmDiv = document.createElement("div");
                      pmDiv.classList.add("payment-method");
                      pmDiv.innerHTML = `
            <p>Card: ${pm.card_type} ending in ${pm.last4} (exp: ${pm.expiration_date})</p>
            <button class="pay-with-token-btn" data-token="${pm.token}">Pay</button>
          `;
                      infoDiv.appendChild(pmDiv);
                    });

                    // attach pay button logic
                    document
                      .querySelectorAll(".pay-with-token-btn")
                      .forEach((btn) => {
                        btn.addEventListener("click", () => {
                          const token = btn.getAttribute("data-token");
                          const amount =
                            document.getElementById("amount").value;

                          fetch("/checkout-with-customer", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              customerId: customerId,
                              amount: amount,

                            }),
                          })
                            .then((res) => res.json())
                            .then((payData) => {
                              if (payData.success) {
                                alert(
                                  "Payment with saved card successful! Transaction ID: " +
                                    payData.transaction_id +
                                    (payData.customer_id
                                      ? ` | Customer: ${payData.customer_id}`
                                      : "")
                                );
                              } else {
                                alert(
                                  "Payment with saved card failed: " +
                                    payData.error
                                );
                              }
                            });
                        });
                      });
                  } else {
                    infoDiv.innerHTML =
                      "<p>No customer found or no payment methods available.</p>";
                  }
                });
            });

          const form = document.getElementById("payment-form");
          form.addEventListener("submit", function (event) {
            event.preventDefault();

            // Collect and validate the amount entered
            const amountInput = document.getElementById("amount");
            const amount = parseFloat(amountInput.value);
            if (!amount || amount <= 0) {
              alert("Please enter a valid amount!");
              return;
            }

            // Collect store card consent
            const storeCardCheckbox = document.getElementById("store-card");
            const storeCardConsent = storeCardCheckbox.checked;

            console.log("Consent:" + storeCardConsent);

            hostedFieldsInstance.tokenize(function (tokenizeErr, payload) {
              if (tokenizeErr) {
                alert("Tokenize error: " + tokenizeErr.message);
                return;
              }

              // Send nonce + amount to backend
              fetch(`${API_BASE}/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentMethodNonce: payload.nonce,
                  amount: amount,
                  storeCard: storeCardConsent,
                }),
              })
                .then((r) => r.json())
                .then((result) => {
                  if (result.success) {
                    alert(
                      "Payment Success! Transaction ID: " +
                        result.transaction_id +
                        "customer_id:" +
                        result.customer_id
                    );
                  } else {
                    alert("Payment Failed: " + result.error, true);
                  }
                });
            });
          });
        }
      );
    }
  );
}

initBraintree();
