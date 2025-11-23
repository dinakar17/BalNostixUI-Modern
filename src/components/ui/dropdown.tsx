import { Feather } from "@expo/vector-icons";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { cn } from "@/lib/utils";

export type DropdownItem = {
  label: string;
  value: string | number;
};

type CustomDropdownProps = {
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  dropdownItems: DropdownItem[];
  handleDropdownSelect: (item: DropdownItem) => void;
  selectedOption: DropdownItem | null;
  placeholder?: string;
  className?: string;
};

export function CustomDropdown({
  showDropdown,
  setShowDropdown,
  dropdownItems = [],
  handleDropdownSelect,
  selectedOption = null,
  placeholder = "Select Option",
  className = "",
}: CustomDropdownProps) {
  const onSelectItem = (item: DropdownItem) => {
    handleDropdownSelect(item);
    setShowDropdown(false);
  };

  return (
    <>
      {/* Dropdown Trigger */}
      <TouchableOpacity
        activeOpacity={0.7}
        className={cn(
          "flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3",
          className
        )}
        onPress={() => setShowDropdown(true)}
      >
        <Text
          className={cn(
            "font-semibold text-base",
            selectedOption ? "text-gray-900" : "text-gray-500"
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Feather
          color="#666"
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
        transparent
        visible={showDropdown}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => setShowDropdown(false)}
        >
          <Pressable
            className="max-h-96 w-11/12 max-w-md overflow-hidden rounded-2xl bg-white"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between border-gray-200 border-b p-4">
              <Text className="font-bold text-gray-800 text-lg">
                {placeholder}
              </Text>
              <TouchableOpacity onPress={() => setShowDropdown(false)}>
                <Feather color="#666" name="x" size={24} />
              </TouchableOpacity>
            </View>

            {/* Dropdown Items */}
            <FlatList
              data={dropdownItems}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              ListEmptyComponent={
                <View className="items-center p-8">
                  <Text className="text-base text-gray-500">
                    No options available
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedOption?.value === item.value;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className={cn(
                      "flex-row items-center justify-between border-gray-100 border-b p-4",
                      isSelected && "bg-blue-50"
                    )}
                    onPress={() => onSelectItem(item)}
                  >
                    <Text
                      className={cn(
                        "font-semibold text-base",
                        isSelected ? "text-blue-600" : "text-gray-800"
                      )}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Feather color="#1976d2" name="check" size={20} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {/* Close Button */}
            <TouchableOpacity
              className="border-gray-200 border-t p-4"
              onPress={() => setShowDropdown(false)}
            >
              <Text className="text-center font-bold text-base text-gray-600">
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
