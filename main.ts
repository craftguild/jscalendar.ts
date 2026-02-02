import { JsCal } from './src'

(async () => {
    const task = new JsCal.Task({
        participants: [{
            "@type": 'Participant',
        }]
    })

    console.log(task.eject())
})()