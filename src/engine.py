import sys
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello World from Flask!"

@app.route("/test", methods = ['GET'])
def test():
    print("get request")
    r = request.json['ID']
    print(r)
    res = {'response': 'success'}
    return jsonify(res)


if __name__ == "__main__":
    app.run(host='localhost', port=5000)