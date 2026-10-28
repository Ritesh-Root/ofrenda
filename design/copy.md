# Ofrenda copy deck (en / es)

## The ghost's voice
The ofrenda is not Rosa. It never says "I" as her and never speaks for the dead. It speaks like a
careful relative holding the family's notebook: plain, warm, short, specific. It quotes the family's
words, names who said them, and when nobody remembered something it says so and invites them to add it.
No "As an AI", no exclamation marks, no spooky clichés. The eeriness comes from the true details.

## Global
| Key | en | es |
|---|---|---|
| product | Ofrenda | Ofrenda |
| nav.stories | Her stories | Sus historias |
| nav.ask | Ask her ofrenda | Pregúntale a su ofrenda |
| nav.altar | On her altar | En su altar |
| nav.add | Add a memory | Agregar un recuerdo |
| back | Back to her ofrenda | Volver a su ofrenda |

(Use his/their forms from the person's `pronouns` field; Rosa's are she/her.)

## Ofrenda page
| Key | en | es |
|---|---|---|
| card.lead | Her ofrenda: {n} stories from {k} of her family, kept on their own laptop. Ask it anything. It answers only with what they remembered. | Su ofrenda: {n} historias de {k} de sus familiares, guardadas en su propia computadora. Pregúntale lo que quieras. Responde solo con lo que ellos recuerdan. |
| intro.h | Who she was | Quién era |
| stories.h | Her stories, as they were told | Sus historias, como las contaron |
| story.also | Also told by {name}: | También contó {name}: |
| ask.h | Ask her ofrenda | Pregúntale a su ofrenda |
| ask.desc | It answers only with what her family told it, and says who told it. If nobody remembered, it says so instead of guessing. | Responde solo con lo que su familia le contó, y dice quién lo contó. Si nadie lo recordó, lo dice en vez de adivinar. |
| ask.label | Your question, in Spanish or English | Tu pregunta, en español o en inglés |
| ask.button | Ask | Preguntar |
| ask.speak | Read the answer aloud | Leer la respuesta en voz alta |
| ask.none | Nobody in her family has told the ofrenda about that yet. You could be the first. | Nadie de su familia le ha contado eso a la ofrenda todavía. Tú puedes contárselo primero. |
| ask.said | {teller}, in “{title}” | {teller}, en “{title}” |
| ask.thinking | Looking through what her family told it… | Buscando entre lo que su familia le contó… |
| altar.h | On her altar | En su altar |
| altar.note | What her family says belongs on it, gathered from their stories. | Lo que su familia dice que va en él, sacado de sus historias. |
| altar.close | Raised on the evening of 31 October. Taken down on 2 November, after the last candle. | Se pone la tarde del 31 de octubre. Se levanta el 2 de noviembre, después de la última vela. |
| reply.say | Nothing on this page has left this laptop. Gemma, an open-weight model, reads the stories here and answers from them with the internet unplugged. | Nada de esta página ha salido de esta computadora. Gemma, un modelo abierto, lee aquí las historias y responde con ellas, aun sin internet. |
| reply.h | Tell her ofrenda | Cuéntale a su ofrenda |
| reply.bar | Record a story | Grabar una historia |
| back.h | Hasta el año que viene | Hasta el año que viene |
| back.msg | Ofrenda is free and open source. It runs on an open-weight model on your own machine, so a family's stories stay in the family. | Ofrenda es libre y de código abierto. Funciona con un modelo abierto en tu propia máquina, para que las historias de una familia se queden en la familia. |
| back.fiction | Rosa Méndez and her family are fictional. Their stories were written for this demo. | Rosa Méndez y su familia son ficticios. Sus historias se escribieron para esta demostración. |

## Add a memory
| Key | en | es |
|---|---|---|
| add.h | Tell {name}'s ofrenda a story | Cuéntale una historia a la ofrenda de {name} |
| add.lead | One memory at a time: something she cooked, said, sang, or did. Say it the way you would tell it at the table. | Un recuerdo a la vez: algo que cocinaba, decía, cantaba o hacía. Cuéntalo como lo contarías en la mesa. |
| add.who | Who is telling it? | ¿Quién lo cuenta? |
| add.say | Say it | Dilo |
| add.rec.start | Start recording | Empezar a grabar |
| add.rec.stop | Stop and keep the recording | Detener y guardar la grabación |
| add.rec.note | Spanish, English, or both in one breath. Up to ten minutes. | Español, inglés, o los dos a la vez. Hasta diez minutos. |
| add.write | Or write it | O escríbelo |
| add.where | Where it is heard | Dónde se escucha |
| add.local | On this laptop · Whisper transcribes it here. Nothing leaves the machine. | En esta computadora · Whisper la transcribe aquí. Nada sale de la máquina. |
| add.cloud | ElevenLabs Scribe · Better with mixed Spanish and English and family names. The recording is sent to ElevenLabs. | ElevenLabs Scribe · Mejor con español e inglés mezclados y con nombres de la familia. La grabación se envía a ElevenLabs. |
| add.offline | Turned off: this ofrenda is offline. | Desactivado: esta ofrenda está sin conexión. |
| add.keep | Keep it on her ofrenda | Guardarlo en su ofrenda |
| heard.h | What the ofrenda heard | Lo que escuchó la ofrenda |
| heard.note | Gemma reads the story and suggests what belongs on the altar. Nothing is added until you keep it. | Gemma lee la historia y sugiere qué va en el altar. No se agrega nada hasta que lo guardes. |
| progress.transcribe | Listening to the recording | Escuchando la grabación |
| progress.extract | Finding what belongs on the altar | Buscando lo que va en el altar |
| progress.embed | Placing it among her stories | Acomodándola entre sus historias |
| progress.done | Kept. It is on her ofrenda now. | Guardado. Ya está en su ofrenda. |
| error.model | The model on this laptop isn't answering. Is Ollama running? `ofrenda doctor` will check. | El modelo de esta computadora no responde. ¿Está corriendo Ollama? `ofrenda doctor` lo revisa. |

## CLI
`ofrenda ask` prints the answer, a blank line, then one line per citation: `— Lupita, her daughter, “Mole on Sundays” (1974)`.
`ofrenda doctor` lines read like: `Gemma 3 4B is pulled and answering (2.1 s).` / `ElevenLabs is off: this ofrenda is offline.`
