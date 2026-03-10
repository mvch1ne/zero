# Development Log

## Next Steps

- Continue with: Any updates to make to docs about these view modes? Do.
- Add module for instantaneous velocity in the static start mode and separate it from the 'average velocity' approach and indicate the difference in the app and in docs. There is a great need to distinguish between the instantaneous velocity of an athlete's CoM at any given point and the 'average velocity' we tend to see used in track and field split-based velocity tracking.
- Add a help button on the header that opens a modal where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Embed a link to the demo video in the GitHub README.md and on the docs page.
- Create a separate branch for hosting and host the frontend and backend. Make sure all the settings and modifications are made so they can talk to each other. Can some automated hosting be done so that anytime that branch changes, both the frontend and backend redeploy? That would be cool. I'm thinking Firebase for the frontend and Fly or Render for the backend but open to suggestions. I want to use free tiers and have the frontend and backend running as seamlessly as possible without any interruptions.
- Add link to frontend Github repository.

## Future Work

- When done, consider create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?
