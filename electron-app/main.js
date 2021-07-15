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



const electron = require( 'electron' ) ;
const path = require( 'path' ) ;
const app = electron.app ;
const BrowserWindow = electron.BrowserWindow ;
const Menu = electron.Menu ;
//const ipcMain = electron.ipcMain ;
const crashReporter = electron.crashReporter ;
const isMac = process.platform === 'darwin' ;

require( './ipc.js' ) ;



// Ensure we are running 'electron' instead of 'node'
var versions = process.versions ;
//console.log( versions ) ;

if ( ! versions.electron ) {
	console.log( "This program should be loaded by 'electron' instead of 'node'" ) ;
	process.exit() ;
}

// Safely set the process' title from the package name
process.title = require( './package.json' ).name ;

// Start the crash reporter
//crashReporter.start() ;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null ;



// Quit when all windows are closed.
app.on( 'window-all-closed' , () => {
	if ( ! isMac ) { app.quit() ; }
} ) ;



var argPos , devTools = false , args = process.argv.slice() ;

// Open dev tools?
if ( ( argPos = args.indexOf( '--dev' ) ) !== -1 ) {
	args.splice( argPos , 1 ) ;
	devTools = true ;
}



// Drop down menu
const menuTemplate = [
	... ( isMac ? [ {
		label: app.name ,
		submenu: [
			{ role: 'about' } ,
			{ type: 'separator' } ,
			{ role: 'services' } ,
			{ type: 'separator' } ,
			{ role: 'hide' } ,
			{ role: 'hideothers' } ,
			{ role: 'unhide' } ,
			{ type: 'separator' } ,
			{ role: 'quit' }
		]
	} ] : [] ) ,
	{
		label: 'File' ,
		submenu: [
			{
				label: 'Load image' ,
				click: async () => {
					if ( ! mainWindow ) { return ; }
					mainWindow.webContents.send( 'guiLoadImage' ) ;
				}
			} ,
			{ type: 'separator' } ,
			{ role: isMac ? 'close' : 'quit' }
		]
	} ,
	{
		label: 'Edit' ,
		submenu: [
			{ role: 'undo' } ,
			{ role: 'redo' } ,
			{ type: 'separator' } ,
			{ role: 'cut' } ,
			{ role: 'copy' } ,
			{ role: 'paste' } ,
			... ( isMac ? [
				{ role: 'pasteAndMatchStyle' } ,
				{ role: 'delete' } ,
				{ role: 'selectAll' } ,
				{ type: 'separator' } ,
				{
					label: 'Speech' ,
					submenu: [
						{ role: 'startSpeaking' } ,
						{ role: 'stopSpeaking' }
					]
				}
			] : [
				{ role: 'delete' } ,
				{ type: 'separator' } ,
				{ role: 'selectAll' }
			] )
		]
	} ,
	{
		label: 'View' ,
		submenu: [
			{ role: 'reload' } ,
			{ role: 'forceReload' } ,
			{ role: 'toggleDevTools' } ,
			{ type: 'separator' } ,
			{ role: 'togglefullscreen' }
		]
	} ,
	{
		label: 'Help' ,
		submenu: [
			{
				label: 'Bob' ,
				click: async () => {
					if ( ! mainWindow ) { return ; }
					mainWindow.webContents.send( 'bob' , 'whoooooooh!' ) ;
				}
			}
		]
	}
] ;

const menu = Menu.buildFromTemplate( menuTemplate ) ;
Menu.setApplicationMenu( menu ) ;



// This method will be called when atom-shell has done everything
// initialization and ready for creating browser windows.
app.on( 'ready' , () => {
	// Create the browser window.
	mainWindow = new BrowserWindow( {
		width: 1200 , //1024 ,
		height: 768 ,
		webPreferences: {
			nodeIntegration: true ,
			contextIsolation: false
		}
	} ) ;

	// Open dev tools?
	if ( devTools ) { mainWindow.openDevTools() ; }

	// and load the index.html of the app.
	var rootDir = path.dirname( __dirname ) ;
	mainWindow.loadURL( 'file://' + rootDir + '/lib/sprite-bump-editor.html' ) ;

	// Emitted when the window is closed.
	mainWindow.on( 'closed' , () => {
		// Dereference the window object.
		// Usually you would store windows in an array if your app supports multi windows,
		// this is the time // when you should delete the corresponding element.
		mainWindow = null ;
	} ) ;
} ) ;

