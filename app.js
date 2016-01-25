/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , methodOverride = require('method-override')
  , session = require('express-session')


var app = module.exports = express();
var nodify = require('nodify-shopify');
 
var apiKey, secret; 
var persistentKeys= {};

//If Heroku or Foreman
 if(process.env.SHOPIFY_API_KEY != undefined && process.env.SHOPIFY_SECRET != undefined){
 	apiKey = process.env.SHOPIFY_API_KEY;
 	secret = process.env.SHOPIFY_SECRET;
}
else {
	var config = require ('./config.json');
	apiKey = config.apiKey;
 	secret = config.secret;
}

// Configuration
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(methodOverride());
app.use(cookieParser());
app.use(session({ secret: "shhhhh!!!!",
    resave: true,
    saveUninitialized: false
 }));
//app.use(app.router);
app.use(express.static(__dirname + '/public'));

// Routes
app.get('/', function(req, res) {
	var shop = undefined, key=undefined;

	if(req.session.shopify){
		shop = req.session.shopify.shop;
		console.log('shop stored in user session:', shop);
		key=persistentKeys[shop];
	}

  if(req.query.shop){
		shop = req.query.shop.replace(".myshopify.com",'');
		console.log('shop given by query:', shop);
		key=persistentKeys[shop];
	}

	if(shop !== undefined && key != undefined) {
		session = nodify.createSession(shop, apiKey, secret, key);
		if(session.valid()){
			console.log('session is valid for <',shop,'>')

			session.order.all({limit: 5}, function(err, orders){
				console.log('orders:',orders);
				if(err) { throw err;}

				session.product.all({limit: 5}, function(err, products){
					console.log("products:", products);
					if(err) {  throw err;}

					res.render("index", {title: "Nodify App", api_key: config.apiKey, current_shop: shop , orders: orders, products: products});
				});

			});
		} 
	}
	else {
		console.log('session is not valid yet, we need some authentication !')
		if(shop !== undefined)
			res.redirect('/login/authenticate?shop='+shop);
		else
			res.redirect('/login')
	}
});


app.get('/login', function(req, res) {
	try {
		shop = res.body.shop;
	}
	catch(error) {
		shop = undefined;
	}

	if(req.session.shopify){
		res.redirect("/");
	}
	else if(shop != undefined) {
		//redirect to auth
		res.redirect("/login/authenticate");
	}
	else{
		res.render("login", {title: "Nodify App"});
	}
});

app.post('/login/authenticate', authenticate);
app.get( '/login/authenticate', authenticate);

function authenticate(req, res) {
	var shop = req.query.shop || req.body.shop;
	if(shop !== undefined && shop !== null) {	
	  console.log('creating a session for', shop, apiKey, secret)
		session = nodify.createSession(shop, apiKey, secret, {
	    scope: {orders: "read", products: "read"},
	    uriForTemporaryToken: "https://"+req.headers.host+"/login/finalize/token",
	    onAskToken: function onToken (err, url) {
	    	res.redirect(url);
	    }
	  });
	}	else {
  	console.log('no shop, go login')
		res.redirect('/login');
	}
}

app.get('/login/finalize', function(req, res) {
  console.log('finalizing ...', req.query)
	params = req.query;
	req.session.shopify = params;
	params.onAskToken = function (err, url) {
		if(err) {
			res.send("Could not finalize");
			console.warn('Could not finalize login :', err)
		}
		res.redirect(url);
	}

	session = nodify.createSession(req.query.shop, apiKey, secret, params);
	if(session.valid()){
		console.log('session is valid!')
		res.redirect("/");
	}
	else {
		res.send("Could not finalize");
	}
});

app.get('/login/finalize/token', function(req, res) {
	if(! req.query.code)
		return res.redirect("/login?error=Invalid%20connection.%20Please Retry")
	session.requestPermanentAccessToken(req.query.code, function onPermanentAccessToken(token) {
		console.log('Authenticated on shop <', req.query.shop, '/', session.store_name, '> with token <', token, '>')
		persistentKeys[session.store_name]=token;
		req.session.shopify = {shop:session.store_name};
		res.redirect('/')
	})
})

app.get('/logout', function(req, res) {	
	if(req.session.shopify){
		req.session.shopify = null;
	}
	console.log('Logged out!')	
	res.redirect('/');
});


app.get('/plans', function(req, res) {	
	if(req.session.shopify){
		token = req.session.shopify.t
		shop = req.session.shopify.shop
	}

	if(shop !== undefined && token !== undefined) {
		res.render("plans", {title: "Nodify App Plans", current_shop: shop});
	}
	else {
		res.redirect('/login');
	}
});


app.get('/faq', function(req, res) {	
	if(req.session.shopify){
		token = req.session.shopify.t
		shop = req.session.shopify.shop
	}

	if(shop !== undefined && token !== undefined) {
		res.render("faq", {title: "Nodify App FAQ", current_shop: shop});
	}
	else {
		res.redirect('/login');
	}
});

var port = process.env.PORT || 3000;

app.listen(port, function() {

	console.log("Running on: ", port);
});

