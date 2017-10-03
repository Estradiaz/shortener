const express = require('express');
const mongoDB = require('mongodb');
const dotenv = require('dotenv');
const assert = require('assert');
dotenv.config();
const DB_URL  = process.env.MONGOLAB_URI;
//console.log(DB_URL);
//connect db
let DBContext = mongoDB.MongoClient;
//console.log(DBContext);



let updateQuery = function (name){
    this.query = { _id: name};
    this.update = { $inc: {"sequence" : 1},
                    $set: {"lastUpdate": new Date().getTime()}
                };
}

let getSequence = function(callback){
    DBContext.connect(DB_URL, function(err, db){   
            let uq = new updateQuery('freecodecamp');
            assert.equal(err, null);
            db.collection('counter').find(uq.query).toArray((err, result)=>{

                assert(err, null);
                db.close();
                callback(result);
            })
    })
}
let output = function(obj){
    return {
        shortener: obj._id,
        URI: obj.url
    }
}
let updateDocument = function(db, obj, res = null, collection = "freecodecamp", callback = function(db){db.close()}){
    console.log("push object");
    let keyTable = "counter";
    let uq = new updateQuery("freecodecamp");
    db.collection(collection).find({url:obj.url}).toArray((err, exists)=>{
        assert.equal(err, null);
        if(exists.length === 0){
        db.collection(keyTable).findAndModify(uq.query,[] , uq.update,(err, doc) => {
            assert.equal(err, null);
            obj._id = doc.value.sequence;
            obj.lastAcces = new Date().getTime();
            obj.created = obj.lastAcces;
                let me = obj;
                db.collection(collection).insertOne(obj, function(err, result){
                    assert.equal(err, null);
                    console.log("inserted obj into ", collection);
                    callback(db);
                    if(res){
                        res.send(output(obj));
                    }
                });
        })
    } else {
        db.collection(collection).findAndModify({_id: exists[0]._id}, [],{ $set: {lastAcces: new Date().getTime()}}, (err, doc)=>{
            res.send(output(doc.value));    
        })
        
    }   
    });
}

let findById  = function(id, cb, collection = "freecodecamp"){
    DBContext.connect(DB_URL, function(err, db){   
        db.collection(collection).find({_id: id}).toArray((err, result) => {
            cb(result);
        })
    });
}

let updateDB = function(obj, res){
    console.log("connect to db");
    DBContext.connect(DB_URL, function(err, db){

        if(err){
            
            console.log("db connect returns err: ", err);
            db.close()
        } else {

            console.log("DB Connection establisched");
            updateDocument(db,obj,res);
            
        }
    });
}

//see if format is correct: ["http://", "https://"]
let destUrlTest = function(dest){
    let [protokoll, adresse] = dest.split("://");
    console.log(protokoll)
    if(["http", "https"].indexOf(protokoll) < 0)
        return false;
    else 
        return true;
    /*
    adresse = adresse.split('/');
    let root = adresse[0];
    let [base, name, topLVL] = root.split('.');
    if(root.split('.').length === 3){
        return true;
    }
    */
    return false;
}

let createEntry = function(req, res){
    
    let dest = req.originalUrl.slice(5);
    if (destUrlTest(dest)){
        updateDB({url: dest}, res);
    } else {
        let error = {
            params: dest,
            date: new Date().getTime(),
            msg: "invalid format"
        }
        res.send(error);
    }
}

let addIFrame = function(req, res){

    let code = parseInt(req.params.sCode);
    DBContext.connect(DB_URL, function(err, db){
    db.collection("freecodecamp").findAndModify({_id: code}, [],{ $set: {lastAcces: new Date().getTime()}}, (err, doc)=>{
        let link = '<a href="'+ doc.value.url +'" target = _blank id = "clickme">witerleitung nach ' + doc.value.url + '</a>';
        //let script =  "<script>(function(){document.getElementById('clickme').click();})();</script>";
        let script =  "<script>(function(){window.location = '" + doc.value.url + "';})();</script>";
        res.send(link + script);
    })
    });
    /*
    findById(code,function(result){
        let link = '<a href="'+ result[0].url +'" target = _blank id = "clickme">witerleitung nach ' + result[0].url + '</a>';
        //let script =  "<script>(function(){document.getElementById('clickme').click();})();</script>";
        let script =  "<script>(function(){window.location = '" + result[0].url + "';})();</script>";
        res.send(link + script);
    })
    */
}

let showHistory = function(callback, numberAcceses = 4){
    DBContext.connect(DB_URL, function(err, db){   
        assert.equal(err, null);
        db.collection("freecodecamp").find({}).sort({"lastAcces": -1}).toArray((err, doc) => {
        //db.collection("freecodecamp").find({}).toArray((err, doc) => {

            assert.equal(err, null);
            callback(doc.slice(0, numberAcceses));
            db.close();
        })
    })
}

//run app
const app = express();

app.get("/new/:url*", createEntry);
app.get("/:sCode", addIFrame);
app.get("/",(rq, rs) =>{
    showHistory((doc)=>{
        let str = "";
        doc.map(x => str += "<p><ul>" + "<li>shortener: " + rq.protocol + '://' + rq.get('host') + "/" + x._id + "</li>" + "<li>URI: " + x.url + "</li>" + "<li>Acces: " + (new Date(x.lastAcces)).toString() + "</li>" + "</ul></p>");
        rs.send(str);
    })
})

let connected = function(){
    console.log("Listens on Port: 3000");
}

let server = app.listen(3000, connected);
