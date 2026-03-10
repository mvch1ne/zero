# Development Log

## Next Steps

- Continue with: Any updates to make to docs about these view modes? Do.

- Let's redefine how we calculate the velocity. For the STATIC START MODE, let's go to using calculations for pure instantaneous velocity, instead of trying to get what the value would look like if we were looking at 10m splits in a race, let's actually use the opportunity we have with this frame-by-frame analysis to compute instantaneous velocity. I'm  guessing the way we get CoM displacement stays the same, but the velocity and acceleration will now be numerically differentiated and smoothed to get instantaneous values). Furthermore, could we find a way to add a readout of instantaneous velocity even within the flying mode? So we compute the zone velocity for the fly zone as we already have it (fly distance / fly time) but also have a sparkline diagram in the panel showing the instantaneous velocity at every frame within the zone. Implement it and UPDATE THE DOCS (including the relevant math part), WITH THIS INFORMATION AND LOGIC ABOUT VELOCITY TRACKING. I think this would mean numeric differentiation, right? 

- MAKE SURE THAT AS LONG AS SOMETHING CHANGES IN THE DOCS FOLDER, WE ALWAYS REDEPLOY.

- Add a help button on the header that opens a modal where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.

- Embed a link to the demo video in the GitHub README.md and on the docs page.

- Create a separate branch for hosting and host the frontend and backend. Make sure all the settings and modifications are made so they can talk to each other. Can some automated hosting be done so that anytime that branch changes, both the frontend and backend redeploy? That would be cool. I'm thinking Firebase for the frontend and Fly or Render for the backend but open to suggestions. I want to use free tiers and have the frontend and backend running as seamlessly as possible without any interruptions.

- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.

- Add link for frontend to Github repository.

- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions?

## Future Work

- When done, consider create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?
