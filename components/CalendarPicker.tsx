import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

interface CalendarPickerProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toDateString = (date: Date): string => date.toISOString().split('T')[0];

const CalendarPicker: React.FC<CalendarPickerProps> = ({ visible, selectedDate, onSelect, onClose }) => {
  const initial = new Date(`${selectedDate}T00:00:00`);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const today = toDateString(new Date());
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const dateString = toDateString(new Date(viewYear, viewMonth, day));
    if (dateString > today) return; // no future logging
    onSelect(dateString);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={goToPreviousMonth} hitSlop={12}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={goToNextMonth} hitSlop={12}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (day === null) return <View key={index} style={styles.cell} />;
              const dateString = toDateString(new Date(viewYear, viewMonth, day));
              const isSelected = dateString === selectedDate;
              const isToday = dateString === today;
              const isFuture = dateString > today;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => handleSelectDay(day)}
                  disabled={isFuture}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isFuture && styles.cellTextDisabled,
                      isSelected && styles.cellTextSelected,
                      isToday && !isSelected && styles.cellTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.todayButton}
            onPress={() => {
              onSelect(today);
              onClose();
            }}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navArrow: {
    fontSize: 24,
    color: '#000000',
    paddingHorizontal: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: '#000000',
    borderRadius: 999,
  },
  cellText: {
    fontSize: 15,
    color: '#000000',
  },
  cellTextDisabled: {
    color: '#DDDDDD',
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cellTextToday: {
    fontWeight: '700',
  },
  todayButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 15,
    color: '#666666',
    textDecorationLine: 'underline',
  },
});

export default CalendarPicker;
