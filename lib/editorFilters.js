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



filters.fillChannel = {
	entry: 'fill channel' ,
	title: 'Fill channel' ,
	filter: 'fillChannel' ,
	params: {
		channel: {
			text: 'Channel:' ,
			type: 'enum' ,
			values: [ 'red' , 'green' , 'blue' , 'alpha' , 'mono' ] ,
			default: 'alpha'
		} ,
		value: {
			text: 'Value: %i' ,
			type: 'integer' ,
			min: 0 ,
			max: 255 ,
			default: 0
		}
	}
} ;

filters.copyChannel = {
	entry: 'copy channel' ,
	title: 'Copy channel' ,
	sourceRequired: true ,
	filter: 'copyChannelToChannel' ,
	params: {
		fromChannel: {
			text: 'From:' ,
			type: 'enum' ,
			values: [ 'red' , 'green' , 'blue' , 'alpha' , 'mono' ] ,
			default: 'alpha'
		} ,
		toChannel: {
			text: 'To:' ,
			type: 'enum' ,
			values: [ 'red' , 'green' , 'blue' , 'alpha' , 'mono' ] ,
			default: 'alpha'
		}
	}
} ;

filters.brightness = {
	entry: 'brightness to value' ,
	title: 'Brightness' ,
	sourceRequired: true ,
	filter: 'brightnessFilter'
} ;

filters.alpha = {
	entry: 'alpha to value' ,
	title: 'Alpha' ,
	sourceRequired: true ,
	filter: 'alphaFilter'
} ;

filters.alphaBevelHeight = {
	entry: 'alpha bevel to value' ,
	title: 'Bevel' ,
	sourceRequired: true ,
	filter: 'alphaBevelHeightFilter' ,
	params: {
		radius: {
			text: 'Radius: %[.2]f' ,
			min: 1 ,
			max: 250 ,
			default: 10
		} ,
		undersampling: {
			text: 'Undersampling: 1/%i' ,
			type: 'integer' ,
			min: 1 ,
			max: 16 ,
			default: 1
		} ,
		transform: {
			text: 'Level transform:' ,
			type: 'enum' ,
			values: [ 'linear' , 'round' ] ,
			default: 'linear'
		}
	}
} ;

filters.heightToNormal = {
	entry: 'normal from heightmap' ,
	title: 'Normal from heightmap' ,
	sourceRequired: true ,
	filter: 'heightToNormalFilter' ,
	params: {
		height: {
			text: 'Height factor: %[.2]f' ,
			min: 0 ,
			max: 100 ,
			default: 10
		}
	}
} ;

filters.normalizeNormals = {
	entry: 'normalize normals' ,
	title: 'Normalize normals' ,
	filter: 'normalizeNormalsFilter' ,
	params: {
		keepXY: {
			text: 'keep XY' ,
			type: 'boolean' ,
			default: false
		}
	}
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
		} ,
		outOfBoundIsBlack: {
			text: 'out is black' ,
			type: 'boolean' ,
			default: false
		} ,
		erosion: {
			text: 'erosion' ,
			type: 'boolean' ,
			default: false
		} ,
		alphaZero: {
			text: 'alpha zero' ,
			type: 'boolean' ,
			default: false
		} ,
		mono: {
			text: 'mono' ,
			type: 'boolean' ,
			default: false
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
		} ,
		horizontal: {
			text: 'horizontal' ,
			type: 'boolean' ,
			default: true
		} ,
		vertical: {
			text: 'vertical' ,
			type: 'boolean' ,
			default: true
		} ,
		outOfBoundIsBlack: {
			text: 'out is black' ,
			type: 'boolean' ,
			default: false
		} ,
		alphaZero: {
			text: 'alpha zero' ,
			type: 'boolean' ,
			default: false
		}
	}
} ;

filters.kernel = {
	entry: 'kernel' ,
	title: 'Kernel' ,
	sourceRequired: true ,
	filter: 'kernelFilter' ,
	params: {
		operation: {
			text: 'Matrix:' ,
			type: 'enum' ,
			values: [ 'identity' , 'sharpen' , 'edge' , 'emboss' , 'gaussian3x3' , 'gaussian5x5' , 'unsharpMasking' ] ,
			default: 'alpha'
		} ,
		clamp: {
			text: 'clamp' ,
			type: 'boolean' ,
			default: false
		} ,
		/*
		outOfBoundIsBlack: {
			text: 'out is black' ,
			type: 'boolean' ,
			default: false
		} ,
		*/
		alphaZero: {
			text: 'alpha zero' ,
			type: 'boolean' ,
			default: false
		} ,
		mono: {
			text: 'mono' ,
			type: 'boolean' ,
			default: false
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

filters.mono = {
	entry: 'mono' ,
	title: 'Mono' ,
	filter: 'monoFilter'
} ;

