// Quote Widget - Daily motivational quotes
import { useMemo } from 'react';

// Collection of motivational quotes for knowledge workers
const QUOTES = [
    { text: "El conocimiento es poder, pero el entusiasmo es la llave.", author: "Bertrand Russell" },
    { text: "La mejor manera de predecir el futuro es creándolo.", author: "Peter Drucker" },
    { text: "Un sistema solo te sirve si realmente lo usas.", author: "David Allen" },
    { text: "La creatividad es inteligencia divirtiéndose.", author: "Albert Einstein" },
    { text: "Los límites de mi lenguaje son los límites de mi mundo.", author: "Ludwig Wittgenstein" },
    { text: "Construimos demasiados muros y no suficientes puentes.", author: "Isaac Newton" },
    { text: "El aprendizaje nunca agota la mente.", author: "Leonardo da Vinci" },
    { text: "Piensa en grande, empieza poco a poco.", author: "Bill Gates" },
    { text: "La productividad no es trabajar más, es trabajar mejor.", author: "Anónimo" },
    { text: "Tu mente es para tener ideas, no para almacenarlas.", author: "David Allen" },
    { text: "La simplicidad es la máxima sofisticación.", author: "Leonardo da Vinci" },
    { text: "Todo es imposible hasta que se hace.", author: "Nelson Mandela" },
    { text: "Las conexiones lo cambian todo.", author: "Niklas Luhmann" },
    { text: "Escribir es pensar en papel.", author: "William Zinsser" },
    { text: "El conocimiento habla, la sabiduría escucha.", author: "Jimi Hendrix" },
    { text: "Cada día trae nuevas oportunidades de aprender.", author: "Anónimo" },
    { text: "Tu segundo cerebro libera tu mente para crear.", author: "Tiago Forte" },
    { text: "La organización es la clave de la libertad.", author: "Marie Kondo" },
    { text: "Las ideas son como conejos. Tienes un par y aprendes a manejarlos.", author: "John Steinbeck" },
    { text: "La memoria es el diario que todos llevamos con nosotros.", author: "Oscar Wilde" },
    { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
    { text: "El sistema perfecto es el que usas consistentemente.", author: "Anónimo" },
    { text: "Conectar ideas es donde ocurre la magia.", author: "Sönke Ahrens" },
    { text: "Pequeños pasos llevan a grandes cambios.", author: "James Clear" },
    { text: "La curiosidad es la brújula del conocimiento.", author: "Anónimo" },
    { text: "Lo que no se registra, no existe.", author: "Anónimo" },
    { text: "Tu PKM es una extensión de tu mente.", author: "Anónimo" },
    { text: "Documenta hoy lo que olvidarás mañana.", author: "Anónimo" },
    { text: "Las notas atómicas construyen ideas moleculares.", author: "Zettelkasten" },
    { text: "Cada objeto es una semilla de conocimiento.", author: "OOPKM" }
];

export const QuoteWidget = () => {
    // Get quote of the day based on date
    const quote = useMemo(() => {
        const today = new Date();
        const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
        );
        return QUOTES[dayOfYear % QUOTES.length];
    }, []);

    return (
        <div className="dashboard-quote-widget">
            <div className="dashboard-quote-text">
                "{quote.text}"
            </div>
            <div className="dashboard-quote-author">
                — {quote.author}
            </div>
        </div>
    );
};
