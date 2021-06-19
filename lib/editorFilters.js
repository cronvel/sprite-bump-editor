/*
	Sprite Bump Editor

	Copyright (c) 2021 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const filters = {} ;
module.exports = filters ;



filters.luminosity = {
	entry: '[source] luminosity > value' ,
	title: 'Luminosity' ,
	sourceRequired: true ,
	filter: 'luminosityFilter'
} ;

filters.alpha = {
	entry: '[source] alpha > value' ,
	title: 'Alpha' ,
	sourceRequired: true ,
	filter: 'alphaFilter'
} ;

filters.alphaEmbossHeightMap = {
	entry: '[source] alpha > emboss > value' ,
	title: 'Emboss' ,
	sourceRequired: true ,
	filter: 'alphaEmbossHeightMapFilter' ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 100 ,
			default: 10
		}
	}
} ;

filters.alphaRoundEmbossHeightMap = {
	entry: '[source] alpha > round emboss > value' ,
	title: 'Round Emboss' ,
	sourceRequired: true ,
	filter: 'alphaEmbossHeightMapFilter' ,
	hiddenParams: { transform: 'circular' } ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 100 ,
			default: 10
		} ,
		undersampling: {
			text: 'Undersampling: 1/%i' ,
			type: 'integer' ,
			min: 1 ,
			max: 16 ,
			default: 1
		}
	}
} ;

filters.heightMapToNormal = {
	entry: '[source] value > height > normal' ,
	title: 'Normal from height' ,
	sourceRequired: true ,
	filter: 'heightMapToNormalFilter' ,
	params: {
		height: {
			text: 'Height factor: %[.2]f' ,
			min: 0 ,
			max: 100 ,
			default: 10
		}
	}
} ;

filters.mono = {
	entry: 'mono' ,
	title: 'Mono' ,
	filter: 'monoFilter'
} ;

filters.blur = {
	entry: 'blur' ,
	title: 'Blur' ,
	filter: 'blurFilter' ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 50 ,
			default: 3
		} ,
		iteration: {
			text: 'Iteration: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 20 ,
			default: 1
		}
	}
} ;

filters.erosionBlur = {
	entry: 'erosion blur' ,
	title: 'Erosion Blur' ,
	filter: 'blurFilter' ,
	hiddenParams: { erosion: true } ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 50 ,
			default: 3
		} ,
		iteration: {
			text: 'Iteration: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 20 ,
			default: 1
		}
	}
} ;

filters.monoBlur = {
	entry: 'mono blur' ,
	title: 'Mono Blur' ,
	filter: 'monoBlurFilter' ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 50 ,
			default: 3
		} ,
		iteration: {
			text: 'Iteration: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 20 ,
			default: 1
		}
	}
} ;

filters.fastBlur = {
	entry: 'fast blur' ,
	title: 'Fast Blur' ,
	filter: 'fastBlurFilter' ,
	params: {
		radius: {
			text: 'Radius: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 50 ,
			default: 3
		}
	}
} ;

filters.horizontalBlur = {
	entry: 'horizontal blur' ,
	title: 'Horizontal Blur' ,
	filter: 'horizontalBlurFilter' ,
	params: {
		radius: {
			text: 'Radius: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 50 ,
			default: 3
		}
	}
} ;

filters.verticalBlur = {
	entry: 'vertical blur' ,
	title: 'Vertical Blur' ,
	filter: 'verticalBlurFilter' ,
	params: {
		radius: {
			text: 'Radius: %i' ,
			type: 'integer' ,
			min: 1 ,
			max: 50 ,
			default: 3
		}
	}
} ;

filters.historyMix = {
	entry: 'history mix' ,
	title: 'History Mix' ,
	filter: 'historyMix' ,
	params: {
		mix: {
			text: 'Mix: %P' ,
			min: 0 ,
			max: 1 ,
			default: 0.5
		}
	}
} ;

