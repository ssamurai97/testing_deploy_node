const mongoose= require('mongoose');

mongoose.Promise = global.Promise;


const slug = require('slugs');


const stroreShema = new mongoose.Schema({
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
        coordinates: [
            {
                type: Number,
                require: 'You must supply cordinates!'
            }
        ],
        address: {
            type:String,
            require: 'You must supply an address!'
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply author'
    }
});

stroreShema.index({ location: '2dsphere'});

stroreShema.pre('save', async function(next){
    if(!this.isModified('name')) {
        next();//skip it
        return;
    }
    this.slug = slug(this.name);
    //find other stores have a slug
    const slugRegex = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`,'i')
    const storeWithSlug = await this.constructor.find({slug: slugRegex});

    if(storeWithSlug.length){
        this.slug = `${this.slug}-${storeWithSlug.length + 1}`;
    }
    next();
});

stroreShema.index({
    name: 'text',
    description: 'text'
});
stroreShema.statics.getTagsList = function() {
    return this.aggregate([
        {$unwind: '$tags'},
        { $group: {_id: '$tags', count: { $sum: 1} }},
        { $sort: { count: -1 } }
    ]);
}
module.exports = mongoose.model('Store', stroreShema);