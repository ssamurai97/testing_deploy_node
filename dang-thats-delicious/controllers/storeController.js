const mongoose = require('mongoose');

const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');


const multerOptions = {
	//read file into storage and check to see if the photo is 
	//allow
	storage: multer.memoryStorage(),
	fileFilter(req, file, next){
		const isPhoto = file.mimetype.startsWith('image/');
		if(isPhoto){
			next(null, true);
		}else{
			next({message:'that filetype isn\'t allowed!'}, false);
		}
	}
};

exports.homePage = (req, res) => {
	
    res.render('index');
};

exports.addStore = (req, res) => {

    res.render('editStore', {title: 'Add Store'});
};

//upload photo function
exports.upload = multer(multerOptions).single('photo');

//-----------------------------------------------------

//resize function 
exports.resize = async(req, res, next) =>{
	// check if there is no new file to resize 
	if(!req.file){
		next();//skip to next middleware
		return;
	}
	const extension = req.file.mimetype.split('/')[1];
	req.body.photo = `${uuid.v4()}.${extension}`;
	// now resize 
	const photo = await jimp.read(req.file.buffer);
	await photo.resize(800, jimp.AUTO);

	await photo.write(`./public/uploads/${req.body.photo}`);
	// once we have written the photo to our filesystem, keep going!
	next();
};
//-------------------------------------------------------------------

exports.createStore = async(req, res) => {
	req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
	req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`);
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async(req, res) =>{
	const page = req.params.page || 1;
	const limit = 4;
	const skip = (page * limit) - limit;
	//query the database for a list of all stores
	const storesPromise=  Store
	.find()
	.skip(skip)
	.limit(limit)
	.sort({ created: 'desc'});

	const countPromise = Store.count();

	const [stores, count] = await Promise.all([storesPromise, countPromise]);

	const pages = Math.ceil(count / limit);
	if(!stores.length && skip){
		req.flash('info', `Hey! You asked for the page ${page}. but that doesn't exits.. so 
		i put you on page ${pages}`);
		res.redirect(`/stores/page/${pages}`);
		return;
	}
	res.render('stores', {title: 'stores', stores, page, pages, count});
};

const confirmOwner = (store, user) => {
	if(!store.author.equals(user._id)) {
		throw Error ('You must own a store in order to edit!');
	}
};
exports.editStore = async(req, res) =>{
	// find the store give id
	const store = await Store.findOne({_id: req.params.id});
	// confirm they are 
	confirmOwner(store, req.user);
	//todo
	// render out the edit form user can update 

	res.render('editStore', {title: `Edit ${store.name}`, store});

};

exports.updateStore= async(req, res) => {

	req.body.location.type = 'Point';
	const store = await Store.findOneAndUpdate({_id: req.params.id}, req.body, {
		new: true, // return the new store instead of old one
		runValidators: true
	}).exec();
	req.flash('success', `Successfully updated <strong>${store.name}</strong>. 
	<a href="/stores/${store.slug}"> view Store -></a>`);

	res.redirect(`/stores/${store._id}/edit`);
};


//==========================================================
exports.getStoreBySlug = async(req, res, next) => {
	const store = await Store.findOne({slug: req.params.slug}).
	populate('author reviews');

	if(!store) return next();
	res.render('store', {store, title: store.name});

}

//==============================================================

exports.getStoreByTag = async(req, res) => {
	
	const tag = req.params.tag;
	const tagsPromise = Store.getTagsList();

	const tagQuery = tag || { $exists: true};

	const storesPromise = Store.find({tags: tagQuery });
	const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

	res.render('tag', {tags, title: 'Tags', tag, stores });
	
};
//end getStoreByTag

//searchStore fn
exports.searchStores = async(req, res) => {
	const stores = await Store
    //first find stores that match
	.find({
		$text: {
			$search: req.query.q
		}
	},{
		score: { $meta: 'textScore'}
	})
	// then sort them
	.sort({
		score: {$meta: 'textScore'}
	})
	//limit to only 5 results
	.limit(5);
	res.json(stores);

}
//=================================================================
//mapStores fn

exports.mapStores =  async (req, res) =>{
	const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
	const q = {
	location: {
		$near: {
			$geometry: {
				type: 'Point',
				coordinates
			},
			$maxDistance: 10000 //10km	
			}
		}
	};
	const stores = await Store.find(q).select('slug name description location photo'
	).limit(10);
	res.json(stores);
};


//mapPage fn 

exports.mapPage = (req, res) =>{
	res.render('map', {title: 'Map'});
}

//heartStore fn
exports.heartStore = async(req, res) => {
	const hearts = req.user.hearts.map(obj => obj.toString());
	const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
	const user = await User
	.findByIdAndUpdate(req.user._id, 
		{ [operator]: {hearts: req.params.id} },
		{ new: true}
		);
	res.json(user);

};
//getHearts fn
exports.getHearts = async(req, res) => {
	const stores = await Store.find({
		_id: {
			$in: req.user.hearts
		}
	});
	res.render('stores', {title: 'Hearted Stores', stores});
}

//getTopStores fn

exports.getTopStores = async(req, res) => {
	const stores = await Store.getTopStores();
	res.render('topStores', { stores, title: '✮ top Stores!'});
}