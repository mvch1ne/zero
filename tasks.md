# Development Log

TODO

- For calibration: I think we're still treating vertical distances like horizontal even though the aspect ratio isn't 1:1. How about we take account of the aspect ratio and scale every measurement based on its vertical and horizontal components to get the real displacement? Is that sound?
- Build feature to suggest first movement (and hence the point to start time measurements) but allow us to override that (there's already a button in the control panel that could be used for that. Although I think it should probably be moved somewhere upwards.)
- Distinguish between the start time and the start line. So that CoM always starts time at start line, from 0m/s and 0m/s^2 BUT it actually starts with a negative distance (how far behind the line it is). I think this might help with the overestimation of the kinematic variables. Also look into filters that can be used to account for drift and other stuff that may be overinflating the value. Sanity check should be the 10m split(s). If the instantaneous velocity values do not make sense compared to the velocity computed at 10m intervals(10m / elapsed time) then something is bonkers. This is where numerical computation comes in, I reckon. Filters might be useful here. Apply similar checks to the angular measures. Also find what unit of measurement for the angular measures is more appropriate for biomechanical analysis. What values do researchers like Ken Clarke and Peter Weyand find in their papers - especially the 'whip from the hip' paper about thigh angular velocity?
- Torso lean angle doesn't make sense to me. Rework to base on horizontal?
- The first ground contact won't have a stride value. I think we can get one by allowing it to be annotated using the start position as a reference (duh!)
- Question accuracy of CoM metrics. It's saying for example that I got to 10m in about 1.83s (probably had a bit of the start cut off) but that my velocity at that point was 7.66m/s but if you compute 10m/1.83s, you're supposed to get 5.46m/s. Any reason for the large large disparity? Also how to distinguish between timings based on CoM and on first reaction - legs, hands,etc?
- Increase the font size in the telemetry section
- Work towards body view looking more like Three.js human model.
- 3D mode is a must. Alternatives to Three.js? Just to make sure there isn't a better tool before I go forward with it.
- When using the export option, let the draw box disappear after I close the panel.
- When done, create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?

## Backend

- Deploy to Fly.io because free tier is more generous and doesn't hibernate? Regardless can write code to warm up the server
-

## Documentation

- Need to find a way to get the Test Driven Development stuff done.
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Use Claude Code to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Let it explain the design decisions and everything. Then host the docs somewhere and link to it in the README.md. Claude can probably help me set that up.
- Speaking of README.md. Let Claude Code scan the entire codebase and write a really good one (for the entire project and also for the frontend and backend)
- Go to Community Standards (https://github.com/mvch1ne/sprintlab/community) and create these things so that the project is up to standard. Ask Claude Code for the things I can do that will make my project stand out.
- Work on my GitHub profile's README.md to make it better.
