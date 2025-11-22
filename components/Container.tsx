import { SafeAreaView } from "react-native";

export const Container = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView className={styles.container}>{children}</SafeAreaView>
);

const styles = {
  container: "flex flex-1 m-6",
};
