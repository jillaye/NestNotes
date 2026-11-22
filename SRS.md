# Nest Notes App

NestNotes is a mobile phone app that keeps track of a collection of mapped gps coordinates of bluebird nest boxes for people to visit and inspect each year. They will use the app to locate, navigate to, inspect and take some notes about the condition of the bird houses, number of eggs inside, etc.

# Basic requirements

- The app will work with or without cell service.
- User accounts and RBAC (Admin and Birder roles) are deferred to v2; v1 will operate locally on-device.

## Tech stack

See [nestnotes.md](.clinerules/nestnotes.md)

## Definitions

- Collection - a group of nest boxes along with information on that nest box. My initial thought is that a collection can be encapsulated into a GeoJSON file.
- Observation - generic term for notes taken on one visit to the box

# Screens

## Splash screen

The splash screen shall allow the user to choose a Collection.

## Map screen

When the user selects a Collection, an in-app map screen will open and display all the nest boxes in the collection as pins/markers. The user's live GPS location will also be displayed on the map

## Nest box details (Bottom Sheet)

Tapping a nest box opens a dismissable bottom sheet over the map with info on that box. The fields on displayed are:

- Name
- GPS coordinates
- Notes - one line per date that notes were taken on that box

There shall be 2 buttons at the bottom of the sheet:

1. New Observation button takes user to the Observation screen
2. Navigate to button uses the phones default mapping application (Google Maps on Android, Apple Maps on iOS) give the user turn-by-turn directions to the box

## Observation screen

This screen shall have the following 2 buttons:

1. "Box present Take New Note" - initiates a form for the user to take a Nest Note
2. "Box missing Take New Note" - initiates a form for the user to take a Box Note

Both types of notes will auto-populate the current date in `MM/DD/YYYY` format (while letting the user edit/backspace over it) and auto-populate the inspector's name by remembering the last entered name.

# Notes

Notes should be a fast, thumb-friendly form designed for outdoor use and saved locally on the device.

## Nest Note fields

The app will offer the following fields for the user to fill in:

- inspector name (text field)
- number of nests (integer)
- number of eggs (integer)
- number of chicks (integer)
- boxes cleaned out (boolean)
- notes (text) here the user can place misc notes

## Box Note fields

- Check box where user can check one or more options:
  - could not find box at all
  - box gone, pole still there
  - pole cut down
- notes (text) here the user can place misc notes
