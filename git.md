git.md
write a script that runs only on the pi
first it checks to see if it's on the pi
then it does a git push of all the changed databases
then it does a git pull for new scripts
then if there's anything that has changed in the git pull it stops and restarts the collect sparse points service
