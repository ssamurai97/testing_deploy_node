const mongoose = require('mongoose');

mongoose.Promise = global.Promise;


const slug = require('slugs');


const storeSchema = new mongoose.Schema({
	name: {
		type: String,
		trime: true,
		required: 'please enter a store name!'
	},
	slug: String,
	description: {
		type: String,
		trim: true

	},
	tags: [String],
	created: {
		type: Date,
		default: Date.now
	},
	location: {
		type: {
			type: String,
			default: 'Point'
		},
		coordinates: [{
			type: Number,
			require: 'You must supply cordinates!'
		}],
		address: {
			type: String,
			require: 'You must supply an address!'
		}
	},
	photo: String,
	author: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: 'You must supply author'
	}
}, {
		toJSON: {
			virtuals: true
		},
		toObject: {
			virtuals: true
		}
	});

storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({
	location: '2dsphere'
});

storeSchema.pre('save', async function (next) {
	if (!this.isModified('name')) {
		next(); //skip it
		return;
	}
	this.slug = slug(this.name);
	//find other stores have a slug
	const slugRegex = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i')
	const storeWithSlug = await this.constructor.find({
		slug: slugRegex
	});

	if (storeWithSlug.length) {
		this.slug = `${this.slug}-${storeWithSlug.length + 1}`;
	}
	next();
});


storeSchema.statics.getTagsList = function () {
	return this.aggregate([{
		$unwind: '$tags'
	},
	{
		$group: {
			_id: '$tags',
			count: {
				$sum: 1
			}
		}
	},
	{
		$sort: {
			count: -1
		}
	}
	]);
};

storeSchema.statics.getTopStores = function () {
	return this.aggregate([
		//lookup stores and populate their reviews
		{
			$lookup: {
				from: 'reviews',
				localField: '_id',
				foreignField: 'store',
				as: 'reviews'
			}
		},
		//filter for only items that have 2 or more reviews
		{$match: { 'reviews.1': { $exists: true}}},
		//add the average reviews field
		{ $addFields: {
			averageRating: { $avg: '$reviews.rating' }
		} },
		//sort it by own new field, highest reviews first
		{ $sort: {averageRating: -1 } },
		//limit at most 10
		{ $limit: 10 }

	]);
};
//find reviews where the stores _id properties === reviews store property
storeSchema.virtual('reviews', {
	ref: 'Review', //what model to link
	localField: '_id', //which field on the store
	foreignField: 'store' // which field on the reviews

});

//-------------------------------------------------------------------------
function autopopulate(next) {
	this.populate('reviews');
	next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate)
module.exports = mongoose.model('Store', storeSchema);