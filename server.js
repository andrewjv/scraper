var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require('path')

var axios = require("axios");
var cheerio = require("cheerio");

var db = require('./models');

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
const MONGODB_URI = "mongodb://localhost/mongoArticles";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

//GET requests to render Handlebars pages
app.get("/", function(req, res) {
  db.Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  db.Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});
// Route for scraping
app.get('/scrape', function (req, res, html) {
  axios.get('http://nytimes.com/').then(function (response) {
    var $ = cheerio.load(response.data);
    var result = [];
    $("article.story").each(function (i, element) {
      // Save an empty result object

      result.title = $(this)
        .children("h2")
        .children('a')
        .text();
      result.link = $(this)
        .children('h2')
        .children("a")
        .attr("href");
      result.summary = $(this)
        .children('.summary')
        .text();
    });

    // Creating a new headline using the `result` object built from scraping
    db.Article.create(result)
      .then(function (dbArticle) {
        //       // View the added result in the console
        console.log(dbArticle);
      })
      .catch(function (err) {
        //       // Error
        return res.json(err);
      });
  });

  // // If we were able to successfully scrape and save a Headline, send a message to the client
  res.send("Scrape Complete");
});

app.get("/articles", function (req, res) {
  db.Article.find({})
    .then(function (dbArticle) {
      res.json(dbArticle)
    })
    .catch(function(err) {
      res.json(err)
    });
});

// // Route for grabbing a specific headline by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
  //   // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    //     // ..and populate all of the notes associated with it
    .populate("note")
    .then(function (dbArticle) {
      //       // If we were able to successfully find an headline with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      //       // If an error occurred, send it to the client
      res.json(err);
    });
});

// // Route for saving/updating an headline's associated Note
app.post("/articles/:id", function (req, res) {
  db.Article.create(req.body)
    .then(function (dbArticle) {
      return db.Article.findOneAndUpdate({}, { $push: { notes: dbArticle._id } }, { new: true });
    })
    .then(function (dbArticle) {
      //       // If the User was updated successfully, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      //       // If an error occurs, send it back to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});

