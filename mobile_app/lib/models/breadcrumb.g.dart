// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'breadcrumb.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class BreadcrumbAdapter extends TypeAdapter<Breadcrumb> {
  @override
  final int typeId = 0;

  @override
  Breadcrumb read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return Breadcrumb(
      longitude: fields[0] as double,
      latitude: fields[1] as double,
      timestamp: fields[2] as DateTime,
      speed: fields[3] as double,
      activityType: fields[4] as String,
      tripId: fields[5] as String,
    );
  }

  @override
  void write(BinaryWriter writer, Breadcrumb obj) {
    writer
      ..writeByte(6)
      ..writeByte(0)
      ..write(obj.longitude)
      ..writeByte(1)
      ..write(obj.latitude)
      ..writeByte(2)
      ..write(obj.timestamp)
      ..writeByte(3)
      ..write(obj.speed)
      ..writeByte(4)
      ..write(obj.activityType)
      ..writeByte(5)
      ..write(obj.tripId);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BreadcrumbAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;

  @override
  int get hashCode => typeId.hashCode;
}
