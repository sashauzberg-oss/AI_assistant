// Nova's built-in jokes (setup, punchline), told on stage when there's no AI or as a fallback.

export const JOKES = [
  ["Why don't scientists trust atoms?", "Because they make up everything."],
  ["Why did the scarecrow win an award?", "He was outstanding in his field."],
  ["What do you call a fake noodle?", "An impasta."],
  ["Why don't skeletons fight each other?", "They don't have the guts."],
  ["I'm reading a book about anti-gravity.", "It's impossible to put down."],
  ["Why did the bicycle fall over?", "It was two tired."],
  ["What do you call a bear with no teeth?", "A gummy bear."],
  ["How does a penguin build its house?", "Igloos it together."],
  ["Why did the math book look sad?", "It had too many problems."],
  ["What did the ocean say to the beach?", "Nothing, it just waved."],
  ["Why do programmers prefer dark mode?", "Because light attracts bugs."],
  ["What's orange and sounds like a parrot?", "A carrot."],
  ["Why did the coffee call the police?", "It got mugged."],
  ["How do you organize a space party?", "You planet."],
  ["Why was the stadium so cool?", "It was full of fans."],
  ["What do you call cheese that isn't yours?", "Nacho cheese."],
  ["Why did the golfer bring two pairs of pants?", "In case he got a hole in one."],
  ["I only know 25 letters of the alphabet.", "I don't know y."],
  ["What did one wall say to the other wall?", "I'll meet you at the corner."],
  ["Why don't eggs tell jokes?", "They'd crack each other up."],
  ["What do you call a sleeping dinosaur?", "A dino-snore."],
  ["Why did the cookie go to the doctor?", "It was feeling crumbly."],
  ["Why did the tomato blush?", "It saw the salad dressing."],
  ["What kind of music do mummies like?", "Wrap music."],
  ["What do you call a fish with no eyes?", "A fsh."],
  ["Why can't a leopard hide?", "Because it's always spotted."],
  ["What do you call a pig that does karate?", "A pork chop."],
  ["Why do cows wear bells?", "Because their horns don't work."],
  ["What do you call a dog magician?", "A labracadabrador."],
  ["Why are cats bad at video games?", "They keep pressing paws."],
  ["What's a cat's favorite color?", "Purr-ple."],
  ["Why did the duck get in trouble?", "It kept quacking jokes in class."],
  ["What do frogs order at restaurants?", "French flies."],
  ["Why don't sharks eat clowns?", "Because they taste funny."],
  ["What do you call a sheep with no legs?", "A cloud."],
  ["How do bees get to school?", "On the school buzz."],
  ["What do you call an alligator in a vest?", "An investigator."],
  ["Why did the owl invite its friends over?", "It didn't want to be owl by itself."],
  ["What do you call a lazy kangaroo?", "A pouch potato."],
  ["Why did the teddy bear skip dessert?", "It was already stuffed."],
  ["What does a cloud wear under its raincoat?", "Thunderwear."],
  ["Why was the broom late?", "It over-swept."],
  ["What did the left eye say to the right eye?", "Between you and me, something smells."],
  ["Why can't you trust a pizza?", "It's too cheesy."],
  ["What do you call a train full of bubblegum?", "A chew-chew train."],
  ["Why did the banana go to the doctor?", "It wasn't peeling well."],
  ["What has ears but can't hear?", "A cornfield."],
  ["Why did the computer go to the doctor?", "It had a virus."],
  ["What do you call a snowman with a six-pack?", "An abdominal snowman."],
  ["Why did the music teacher need a ladder?", "To reach the high notes."],
  ["What do you call a dinosaur with a big vocabulary?", "A thesaurus."],
  ["Why did the kid bring a ladder to school?", "Because it was going to high school."],
  ["What do you call a boomerang that won't come back?", "A stick."],
  ["Why don't oysters share their pearls?", "Because they're shellfish."],
  ["What did the big flower say to the little flower?", "Hi, bud!"],
  ["Why did the moon skip dinner?", "It was already full."],
  ["What do you call a belt made of watches?", "A waist of time."],
  ["Why did the pencil go to bed?", "It was too tired to write."],
  ["How do you make an octopus laugh?", "With ten-tickles."],
  ["Why did the turtle cross the road?", "To get to the shell station."],
];

/** A random joke, avoiding the indexes in `recent`. Returns { index, setup, punchline }. */
export function randomJoke(recent = [], random = Math.random) {
  const skip = new Set(recent);
  const choices = JOKES.map((_, i) => i).filter((i) => !skip.has(i));
  const pool = choices.length ? choices : JOKES.map((_, i) => i);
  const index = pool[Math.floor(random() * pool.length)];
  const [setup, punchline] = JOKES[index];
  return { index, setup, punchline };
}

/** How a joke reads in the chat. */
export function jokeText({ setup, punchline }) {
  return `🎤 ${setup}\n\n**${punchline}**`;
}
