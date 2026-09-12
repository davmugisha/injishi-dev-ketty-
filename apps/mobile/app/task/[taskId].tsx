/**
 * Task detail - frame W3. The timer, the desk's notes, one primary action and
 * two escapes.
 */
import { useLocalSearchParams } from 'expo-router';
import { TaskDetail } from '@/screens/work';

export default function TaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  return <TaskDetail taskId={taskId} />;
}
