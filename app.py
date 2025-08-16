from flask import Flask, request, jsonify, render_template
import braintree

app = Flask(__name__)

# Braintree Gateway config
gateway = braintree.BraintreeGateway(
    braintree.Configuration(
        environment=braintree.Environment.Sandbox,
        merchant_id="m86f65qrtsmw738x",
        public_key="2gphrt8hhkbt8gbr",
        private_key="74c619b257a87287dc2298ee20e94a82",
    )
)


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/client_token", methods=["GET"])
def client_token():
    token = gateway.client_token.generate()
    return jsonify({"clientToken": token})


@app.route("/checkout", methods=["POST"])
def checkout():
    data = request.json
    nonce = data.get("paymentMethodNonce")
    amount = data.get("amount")
    storeCard = data.get("storeCard")
    customer = None

    # Create customer and payment_method if user gives their consent
    if storeCard:
        result = gateway.customer.create(
            {
                "first_name": "Jen",
                "last_name": "Smith",
                "company": "Braintree",
                "email": "jen@example.com",
                "phone": "312.555.1234",
                "fax": "614.555.5678",
                "website": "www.example.com",
            }
        )
        if result.is_success:
            customer = result.customer.id

    result = gateway.transaction.sale(
        {
            "amount": amount,
            "payment_method_nonce": nonce,
            "customer_id": customer,
            "options": {
                "submit_for_settlement": True,
                "store_in_vault_on_success": storeCard,
            },
        }
    )
    if result.is_success:

        return jsonify(
            {
                "success": True,
                "transaction_id": result.transaction.id,
                "customer_id": customer,
            }
        )
    else:
        return jsonify({"success": False, "error": result.message}), 400


@app.route("/search-customer", methods=["POST"])
def search_customer():
    data = request.json
    customer_id = data.get("customerId")

    try:
        customer = gateway.customer.find(customer_id)

        payment_methods = []
        for pm in customer.payment_methods:
            payment_methods.append(
                {
                    "token": pm.token,
                    "card_type": getattr(pm, "card_type", ""),
                    "last4": getattr(pm, "last_4", ""),
                    "expiration_date": getattr(pm, "expiration_date", ""),
                }
            )

        return jsonify(
            {
                "success": True,
                "customer_id": customer.id,
                "payment_methods": payment_methods,
            }
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/checkout-with-customer", methods=["POST"])
def checkout_with_customer():
    data = request.json
    customer_id = data.get("customerId")
    amount = data.get("amount")

    try:
        # Create a transaction using the customer ID
        result = gateway.transaction.sale({
            "customer_id": customer_id,
            "amount": amount,
            "options": {
                "submit_for_settlement": True
            }
        })

        if result.is_success:
            return jsonify({
                "success": True,
                "transaction_id": result.transaction.id,
                "customer_id": result.transaction.customer_details.id
            })
        else:
            return jsonify({
                "success": False,
                "error": str(result.message)
            })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


if __name__ == "__main__":
    app.run(debug=True, port=8080)
