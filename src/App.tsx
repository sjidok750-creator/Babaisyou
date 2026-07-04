import { AnimatePresence, motion } from 'framer-motion';
import Game from './screens/Game';
import LevelSelect from './screens/LevelSelect';
import Title from './screens/Title';
import { useGameStore } from './store/gameStore';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="mx-auto h-full max-w-md" style={{ background: 'var(--c-bg)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {screen === 'title' && <Title />}
          {screen === 'levels' && <LevelSelect />}
          {screen === 'game' && <Game />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
